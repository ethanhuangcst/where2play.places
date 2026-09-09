import type { ItineraryDto, ItineraryDayDto, ItinerarySlot, PlanBoundaries } from "./itinerary-types";
import type { SlotPreviewPayload } from "./itinerary-map";
import {
  buildDiscoverPlacesBody,
  buildMakeItineraryBody,
  mapPace,
  mapSpend,
  normalizeAgentTime,
  planDayDates,
  tripLedgerFields,
} from "./plan-agent-body";
import { previewForSkeletonStop, previewForTransitLeg } from "./plan-slot-preview";
import { sanitizeDailyStartName } from "./plan-resolve-origin";
import { skeletonMakeErrorKey } from "./format-plan-elapsed";
import {
  discoverPlaces,
  makeItinerary,
  planNextStop,
  fetchTripDetails,
  travelTips,
  geocode,
  type AgentEnvelope,
} from "../places-agent/client";
import {
  mapLegsToTransitSlot,
  mapStopDisplayToPlaceSlot,
  skeletonDayHighlights,
  type StopDisplayPayload,
} from "./itinerary-skeleton-map";
import {
  tripFetchSlice,
  candidatesFromSlice,
  skeletonStopCount,
  skeletonIsFillable,
  artifactsTipsFromSlice,
} from "./plan-fetch-trip";
import { t as catalogT } from "../i18n/catalog";

export type SkeletonPlanProgressEvent =
  | { type: "phase"; phase: "discovering" | "skeleton" | "filling"; dayIndex?: number; daysTotal?: number }
  | { type: "skeleton_start"; daysTotal: number; itinerary: ItineraryDto }
  | {
      type: "skeleton_day";
      dayIndex: number;
      theme?: string;
      stops?: { name: string; meal_slot?: string; kind?: string }[];
      itinerary: ItineraryDto;
    }
  | { type: "skeleton_done"; itinerary: ItineraryDto; tripId?: string; revision?: number }
  | { type: "ledger"; tripId?: string; revision?: number }
  | { type: "transit"; dayIndex: number; slot: ItinerarySlot; itinerary: ItineraryDto }
  | ({ type: "slot_preview"; dayIndex: number } & SlotPreviewPayload)
  | { type: "stop_filled"; dayIndex: number; stopIndex: number; slot: ItinerarySlot; itinerary: ItineraryDto }
  | { type: "day_done"; dayIndex: number; daysTotal: number; itinerary: ItineraryDto }
  | { type: "done"; itinerary: ItineraryDto }
  | { type: "tips"; data: Record<string, unknown> }
  | { type: "error"; key: string; detail?: string };

type SkeletonStop = {
  name: string;
  kind?: string;
  meal_slot?: string;
  provider?: string;
  native_id?: string;
  visit_part?: "am" | "pm" | string;
  lat?: number;
  lng?: number;
};
type SkeletonDay = { day_index: number; day_theme?: string; stops: SkeletonStop[] };
type Skeleton = { days: SkeletonDay[] };

type CandidatePools = { places: unknown[]; restaurants: unknown[] };

const MEAL_SLOT_IDS = new Set(["lunch", "dinner", "afternoon_tea"]);

function poolsFromDiscoverData(data: unknown): CandidatePools {
  if (!data || typeof data !== "object") return { places: [], restaurants: [] };
  const rec = data as Record<string, unknown>;
  let cand: unknown = rec.candidates;
  if ((!cand || typeof cand !== "object") && rec.data && typeof rec.data === "object") {
    cand = (rec.data as Record<string, unknown>).candidates;
  }
  if (!cand || typeof cand !== "object") return { places: [], restaurants: [] };
  const places = (cand as { places?: unknown }).places;
  const restaurants = (cand as { restaurants?: unknown }).restaurants;
  return {
    places: Array.isArray(places) ? places : [],
    restaurants: Array.isArray(restaurants) ? restaurants : [],
  };
}

function emptyItinerary(criteria: PlanBoundaries): ItineraryDto {
  return {
    title: criteria.destination,
    destination: criteria.destination,
    daysCount: criteria.days,
    updatedAt: new Date().toISOString(),
    days: [],
  };
}

function mergeDay(itinerary: ItineraryDto, day: ItineraryDayDto): ItineraryDto {
  const days = itinerary.days.filter((d) => d.dayIndex !== day.dayIndex);
  days.push(day);
  days.sort((a, b) => a.dayIndex - b.dayIndex);
  return { ...itinerary, days, updatedAt: new Date().toISOString() };
}

function tt(locale: string) {
  return (key: string, vars?: Record<string, string>) => catalogT(locale, key, vars);
}

function asSkeleton(raw: unknown): Skeleton | null {
  if (!raw || typeof raw !== "object") return null;
  const days = (raw as { days?: unknown }).days;
  if (!Array.isArray(days)) return null;
  return { days: days as SkeletonDay[] };
}

function stopPointerFields(stop: SkeletonStop): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (stop.provider) out.provider = stop.provider;
  if (stop.native_id) out.native_id = stop.native_id;
  if (stop.visit_part === "am" || stop.visit_part === "pm") out.visit_part = stop.visit_part;
  if (typeof stop.lat === "number") out.lat = stop.lat;
  if (typeof stop.lng === "number") out.lng = stop.lng;
  return out;
}

function enrichStopFromPool(stop: SkeletonStop, pool: CandidatePools): SkeletonStop {
  const card = [...pool.places, ...pool.restaurants].find(
    (p) => (p as { name?: string }).name === stop.name,
  ) as
    | {
        provider?: string;
        location?: { lat?: number; lng?: number };
        sources?: Array<{ provider?: string; native_id?: string }>;
      }
    | undefined;
  if (!card) return stop;
  const src = card.sources?.find((s) => s.native_id);
  return {
    ...stop,
    provider: stop.provider ?? src?.provider ?? card.provider,
    native_id: stop.native_id ?? src?.native_id,
    lat: stop.lat ?? card.location?.lat,
    lng: stop.lng ?? card.location?.lng,
  };
}

function placeSlotMapOpts(stop: SkeletonStop, pool: CandidatePools) {
  const enriched = enrichStopFromPool(stop, pool);
  const mealSlot =
    stop.meal_slot === "lunch" ||
    stop.meal_slot === "dinner" ||
    stop.meal_slot === "afternoon_tea"
      ? stop.meal_slot
      : MEAL_SLOT_IDS.has(stop.name)
        ? (stop.name as "lunch" | "dinner" | "afternoon_tea")
        : undefined;
  return {
    visit_part: stop.visit_part,
    provider: enriched.provider,
    nativeId: enriched.native_id,
    mealSlot,
    pool: {
      places: pool.places as Array<{ name?: string; provider?: string; photos?: string[]; sources?: Array<{ provider?: string; native_id?: string }> }>,
      restaurants: pool.restaurants as Array<{ name?: string; provider?: string; photos?: string[]; sources?: Array<{ provider?: string; native_id?: string }> }>,
    },
  };
}

/** F92 / ADR-053: stamp stay coords from origin card; do not overwrite existing stay pins. */
function stampStayCoords(
  skeleton: Skeleton,
  origin: { lat?: number; lng?: number; native_id?: string } | undefined,
): void {
  if (typeof origin?.lat !== "number" || typeof origin?.lng !== "number") return;
  for (const day of skeleton.days) {
    for (const stop of day.stops) {
      if (stop.kind !== "stay") continue;
      if (typeof stop.lat === "number" && typeof stop.lng === "number") continue;
      stop.lat = origin.lat;
      stop.lng = origin.lng;
      if (origin.native_id && !stop.native_id) stop.native_id = origin.native_id;
    }
  }
}

function slimPool(pool: CandidatePools): CandidatePools {
  const slim = (c: Record<string, unknown>) => {
    const o: Record<string, unknown> = { name: c.name };
    if (c.location) o.location = c.location;
    if (c.sources) o.sources = c.sources;
    if (c.provider) o.provider = c.provider;
    if (c.rating !== undefined) o.rating = c.rating;
    if (c.user_ratings_total !== undefined) o.user_ratings_total = c.user_ratings_total;
    if (c.must_see !== undefined) o.must_see = c.must_see;
    if (c.user_requested !== undefined) o.user_requested = c.user_requested;
    // Keep first photo for itinerary thumbs (24-P0-ui-C-fix); no city encyclopedia.
    if (Array.isArray(c.photos) && typeof c.photos[0] === "string") {
      o.photos = [c.photos[0]];
    }
    return o;
  };
  return {
    places: pool.places.map((p) => slim(p as Record<string, unknown>)),
    restaurants: pool.restaurants.map((p) => slim(p as Record<string, unknown>)),
  };
}

type PlanNextStopData = StopDisplayPayload & {
  legs?: unknown[];
  trip_id?: string;
  revision?: number;
  next_stop?: { name?: string; location?: { lat?: number; lng?: number } | null };
};

export async function* planItinerarySkeletonFill(
  criteria: PlanBoundaries,
  opts: { locale: string; providers?: string[] },
): AsyncGenerator<SkeletonPlanProgressEvent> {
  const t = tt(opts.locale);
  let itinerary = emptyItinerary(criteria);
  const daysTotal = Math.max(1, criteria.days);

  yield { type: "phase", phase: "discovering" };

  // F92 / ADR-053: stay = originStay pointer, else intake coords, else city geocode.
  let origin: { name: string; lat?: number; lng?: number; provider?: string; native_id?: string } = {
    name:
      sanitizeDailyStartName(criteria.dailyStart) || criteria.destination.trim(),
  };
  if (criteria.originStay?.name?.trim()) {
    origin = {
      name: criteria.originStay.name.trim(),
      lat: criteria.originStay.lat,
      lng: criteria.originStay.lng,
      ...(criteria.originStay.provider ? { provider: criteria.originStay.provider } : {}),
      ...(criteria.originStay.native_id ? { native_id: criteria.originStay.native_id } : {}),
    };
  } else if (typeof criteria.originLat === "number" && typeof criteria.originLng === "number") {
    origin = { ...origin, lat: criteria.originLat, lng: criteria.originLng };
  } else {
    try {
      const geo = await geocode({
        query: criteria.destination.trim(),
        locale: opts.locale,
        ...(opts.providers?.length ? { providers: opts.providers } : {}),
      });
      if (geo.ok && geo.data && typeof geo.data.lat === "number" && typeof geo.data.lng === "number") {
        origin = { ...origin, lat: geo.data.lat, lng: geo.data.lng };
      }
    } catch {
      /* stay may remain name-only */
    }
  }

  const pool: CandidatePools = { places: [], restaurants: [] };
  let tripId = criteria.tripId;
  let revision = criteria.revision;

  if (tripId) {
    const fetchedPool = await fetchTripDetails({
      trip_id: tripId,
      fields: ["candidates"],
      locale: opts.locale,
    });
    if (fetchedPool.ok) {
      const { slice, revision: nextRev } = tripFetchSlice(fetchedPool);
      const fromStore = candidatesFromSlice(slice);
      if (fromStore) {
        pool.places = fromStore.places;
        pool.restaurants = fromStore.restaurants;
      }
      if (typeof nextRev === "number") revision = nextRev;
    }
  }

  if (!pool.places.length) {
    const discoverBody = {
      ...buildDiscoverPlacesBody(criteria, opts),
      ...(origin ? { origin } : {}),
      ...tripLedgerFields(tripId, revision),
    };
    const disc = await discoverPlaces(discoverBody);
    if (!disc.ok) {
      yield { type: "error", key: disc.outcome?.key ?? "errors.provider_failed" };
      return;
    }
    const fromDisc = poolsFromDiscoverData(disc.data);
    pool.places = fromDisc.places;
    pool.restaurants = fromDisc.restaurants;
    tripId = (disc.data as { trip_id?: string })?.trip_id ?? tripId;
    revision = (disc.data as { revision?: number })?.revision ?? revision;
    if ((!pool.places.length) && tripId) {
      const fetchedPool = await fetchTripDetails({
        trip_id: tripId,
        fields: ["candidates"],
        locale: opts.locale,
      });
      if (fetchedPool.ok) {
        const { slice, revision: nextRev } = tripFetchSlice(fetchedPool);
        const fromStore = candidatesFromSlice(slice);
        if (fromStore && fromStore.places.length) {
          pool.places = fromStore.places;
          pool.restaurants = fromStore.restaurants;
        }
        if (typeof nextRev === "number") revision = nextRev;
      }
    }
  }

  // Empty discover/store is OK: make_itinerary merges city stops pool (ADR-056).

  if (tripId) {
    yield { type: "ledger", tripId, revision };
  }

  yield { type: "phase", phase: "skeleton" };

  const mkBody = buildMakeItineraryBody(criteria, {
    ...opts,
    candidates: slimPool(pool),
    origin,
    tripId,
    revision,
  });
  const mk = await makeItinerary(mkBody);
  let skeleton: Skeleton | null = null;
  if (mk.ok && mk.data) {
    skeleton = asSkeleton((mk.data as { skeleton?: unknown }).skeleton);
    tripId = (mk.data as { trip_id?: string }).trip_id ?? tripId;
    revision = (mk.data as { revision?: number }).revision ?? revision;
  }
  if (!skeleton?.days?.length && tripId) {
    const recovered = await fetchTripDetails({
      trip_id: tripId,
      fields: ["skeleton"],
      locale: opts.locale,
    });
    if (recovered.ok) {
      const { slice, revision: nextRev } = tripFetchSlice(recovered);
      const fromStore = asSkeleton(slice.skeleton);
      if (fromStore && skeletonIsFillable(fromStore)) {
        skeleton = fromStore;
        if (typeof nextRev === "number") revision = nextRev;
      }
    }
  }
  if (!skeleton?.days?.length) {
    const key = skeletonMakeErrorKey({
      makeOutcomeKey: mk.outcome?.key,
    });
    const detail =
      typeof mk.data === "object" && mk.data && "detail" in mk.data
        ? String((mk.data as { detail?: unknown }).detail ?? "")
        : mk.outcome?.key;
    yield { type: "error", key, detail: detail || undefined };
    return;
  }

  stampStayCoords(skeleton, origin);

  if (tripId) {
    const fetched = await fetchTripDetails({
      trip_id: tripId,
      fields: ["skeleton"],
      locale: opts.locale,
    });
    if (fetched.ok) {
      const { slice, revision: nextRev } = tripFetchSlice(fetched);
      const fromStore = asSkeleton(slice.skeleton);
      if (fromStore?.days?.length) {
        const envelopeStops = skeletonStopCount(skeleton);
        const storeStops = skeletonStopCount(fromStore);
        if (storeStops >= envelopeStops) {
          skeleton.days = fromStore.days;
          stampStayCoords(skeleton, origin);
        }
      }
      if (typeof nextRev === "number") revision = nextRev;
    }
  }

  yield { type: "skeleton_start", daysTotal, itinerary };

  for (const skDay of skeleton.days) {
    const dayIndex = skDay.day_index;
    const pendingDay: ItineraryDayDto = {
      dayIndex,
      highlights: skeletonDayHighlights(dayIndex, skDay.day_theme, t),
      slots: [],
    };
    itinerary = mergeDay(itinerary, pendingDay);
    yield {
      type: "skeleton_day",
      dayIndex,
      theme: skDay.day_theme,
      stops: skDay.stops,
      itinerary,
    };
  }
  yield { type: "skeleton_done", itinerary, tripId, revision };

  if (tripId) {
    const tipsWrite = await travelTips({
      destination: criteria.destination.trim(),
      bounds: {
        start: criteria.startDate,
        end: planDayDates(daysTotal, criteria.startDate)[daysTotal - 1] ?? criteria.startDate,
      },
      locale: opts.locale,
      ...(opts.providers?.length ? { providers: opts.providers } : {}),
      skeleton,
      ...tripLedgerFields(tripId, revision),
    });
    if (tipsWrite.ok && tipsWrite.data) {
      tripId = (tipsWrite.data as { trip_id?: string }).trip_id ?? tripId;
      revision = (tipsWrite.data as { revision?: number }).revision ?? revision;
      const fetchedTips = await fetchTripDetails({
        trip_id: tripId,
        fields: ["artifacts"],
        locale: opts.locale,
      });
      if (fetchedTips.ok) {
        const { slice, revision: r } = tripFetchSlice(fetchedTips);
        if (typeof r === "number") revision = r;
        const tips = artifactsTipsFromSlice(slice);
        if (tips) yield { type: "tips", data: tips };
      }
    }
  }

  yield { type: "phase", phase: "filling", dayIndex: 1, daysTotal };

  const dates = planDayDates(daysTotal, criteria.startDate);
  const usedRestaurantNames: string[] = [];

  for (const skDay of skeleton.days) {
    const dayIndex = skDay.day_index;
    yield { type: "phase", phase: "filling", dayIndex, daysTotal };

    let daySlots: ItinerarySlot[] = [];
    let prevEndTime: string | undefined;
    let prevStop: SkeletonStop | undefined;
    let stopIndex = 0;

    while (stopIndex < skDay.stops.length) {
      const stop = skDay.stops[stopIndex]!;
      const isOriginStay = stopIndex === 0 && stop.kind === "stay";

      yield {
        type: "slot_preview",
        dayIndex,
        ...previewForSkeletonStop(stop, t),
      };

      const lookahead = skDay.stops
        .slice(stopIndex + 1)
        .find((s) => s.kind !== "stay" && s.kind !== "meal" && !MEAL_SLOT_IDS.has(s.name));

      const fill = await fillStop({
        stop,
        stopIndex,
        dayIndex,
        skDay,
        pool,
        criteria,
        opts,
        prevStop,
        prevEndTime,
        isOriginStay,
        tripId,
        revision,
        usedRestaurantNames,
        lookahead,
      });
      if (!fill.ok) {
        yield { type: "error", key: fill.key ?? "errors.provider_failed" };
        return;
      }
      tripId = fill.tripId ?? tripId;
      revision = fill.revision ?? revision;

      if (fill.skeletonPatched) {
        const beforeKey = skDay.stops.map((s) => `${s.kind}:${s.name}:${s.meal_slot}`).join("|");
        if (tripId) {
          const fetchedSk = await fetchTripDetails({
            trip_id: tripId,
            fields: ["skeleton", "cursor"],
            locale: opts.locale,
          });
          if (fetchedSk.ok) {
            const { slice, revision: r } = tripFetchSlice(fetchedSk);
            if (typeof r === "number") revision = r;
            const raw = (slice as { skeleton?: unknown })?.skeleton ?? slice;
            const refreshed = asSkeleton(raw);
            if (refreshed) {
              const refreshedDay = refreshed.days.find((d) => d.day_index === dayIndex);
              if (refreshedDay) {
                skDay.stops = refreshedDay.stops;
                skeleton.days = refreshed.days;
              }
            }
          }
        } else if (fill.patchedDayStops?.length) {
          skDay.stops = fill.patchedDayStops;
        }
        const afterKey = skDay.stops.map((s) => `${s.kind}:${s.name}:${s.meal_slot}`).join("|");
        // No-op / failed patch: do not spin — advance (agent should fill on no-op move).
        if (beforeKey === afterKey) stopIndex += 1;
        continue;
      }

      if (tripId) {
        const fetchedFill = await fetchTripDetails({
          trip_id: tripId,
          fields: ["filled", "cursor"],
          locale: opts.locale,
        });
        if (fetchedFill.ok) {
          const { revision: r } = tripFetchSlice(fetchedFill);
          if (typeof r === "number") revision = r;
        }
      }

      if (fill.mealSkipped) {
        const placeSlot = mapStopDisplayToPlaceSlot(
          {
            stop: {
              name: stop.meal_slot ?? stop.name,
              kind: "meal",
              card: null,
              deeplinks: {},
            },
            slot: fill.display?.slot ?? { start: prevEndTime ?? "12:00", end: prevEndTime ?? "12:00" },
            legs_to_here: [],
          },
          t,
          placeSlotMapOpts(stop, pool),
        );
        daySlots = [...daySlots, placeSlot];
        prevStop = stop;
        itinerary = mergeDay(itinerary, {
          dayIndex,
          highlights: skeletonDayHighlights(dayIndex, skDay.day_theme, t),
          slots: daySlots,
          meta: { window: dates[dayIndex - 1] },
        });
        yield { type: "stop_filled", dayIndex, stopIndex, slot: placeSlot, itinerary };
        stopIndex += 1;
        continue;
      }

      if (!isOriginStay && fill.legs?.length) {
        yield {
          type: "slot_preview",
          dayIndex,
          ...previewForTransitLeg(stop.name, fill.legs, t),
        };
        const transitSlot = mapLegsToTransitSlot(fill.legs, t, {
          from: prevStop?.name,
          to: stop.name,
        });
        if (transitSlot) {
          daySlots = [...daySlots, transitSlot];
          itinerary = mergeDay(itinerary, {
            dayIndex,
            highlights: skeletonDayHighlights(dayIndex, skDay.day_theme, t),
            slots: daySlots,
          });
          yield { type: "transit", dayIndex, slot: transitSlot, itinerary };
        }
      }

      const placeSlot = mapStopDisplayToPlaceSlot(fill.display ?? {}, t, placeSlotMapOpts(stop, pool));
      daySlots = [...daySlots, placeSlot];
      prevEndTime = fill.display?.slot?.end
        ? normalizeAgentTime(fill.display.slot.end)
        : prevEndTime;
      const venueLoc = (fill.display as PlanNextStopData | undefined)?.next_stop?.location;
      prevStop =
        stop.kind === "meal" || stop.meal_slot
          ? {
              ...stop,
              name: placeSlot.name,
              ...(typeof venueLoc?.lat === "number" && typeof venueLoc?.lng === "number"
                ? { lat: venueLoc.lat, lng: venueLoc.lng }
                : {}),
            }
          : stop;

      if (
        (stop.kind === "meal" || stop.meal_slot || MEAL_SLOT_IDS.has(stop.name)) &&
        placeSlot.name &&
        !MEAL_SLOT_IDS.has(placeSlot.name)
      ) {
        usedRestaurantNames.push(placeSlot.name);
        yield {
          type: "slot_preview",
          dayIndex,
          kind: "meal",
          name: placeSlot.name,
          reason: t("play.plan.preview_reason_skeleton"),
          window:
            placeSlot.start && placeSlot.end
              ? `${placeSlot.start}–${placeSlot.end}`
              : "…",
          mealLabel:
            stop.meal_slot === "dinner" || stop.meal_slot === "afternoon_tea"
              ? stop.meal_slot
              : stop.meal_slot === "lunch"
                ? "lunch"
                : MEAL_SLOT_IDS.has(stop.name)
                  ? (stop.name as "lunch" | "dinner" | "afternoon_tea")
                  : "lunch",
        };
      }

      itinerary = mergeDay(itinerary, {
        dayIndex,
        highlights: skeletonDayHighlights(dayIndex, skDay.day_theme, t),
        slots: daySlots,
        meta: { window: dates[dayIndex - 1] },
      });
      yield { type: "stop_filled", dayIndex, stopIndex, slot: placeSlot, itinerary };
      stopIndex += 1;
    }

    yield { type: "day_done", dayIndex, daysTotal, itinerary };
  }

  yield { type: "done", itinerary };
}

async function fillStop(input: {
  stop: SkeletonStop;
  stopIndex: number;
  dayIndex: number;
  skDay: SkeletonDay;
  pool: CandidatePools;
  criteria: PlanBoundaries;
  opts: { locale: string; providers?: string[] };
  prevStop?: SkeletonStop;
  prevEndTime?: string;
  isOriginStay: boolean;
  tripId?: string;
  revision?: number;
  usedRestaurantNames?: string[];
  lookahead?: SkeletonStop;
}): Promise<{
  ok: boolean;
  key?: string;
  display?: StopDisplayPayload;
  legs?: Array<{ mode?: string; duration_min?: number; recommended?: boolean }>;
  tripId?: string;
  revision?: number;
  skeletonPatched?: boolean;
  mealSkipped?: boolean;
  patchedDayStops?: SkeletonStop[];
}> {
  const pace = mapPace(input.criteria.pace);
  const budget = mapSpend(input.criteria.budget);
  const nextEnriched = enrichStopFromPool(input.stop, input.pool);
  const body: Record<string, unknown> = {
    locale: input.opts.locale,
    ...(input.opts.providers?.length ? { providers: input.opts.providers } : {}),
    city: input.criteria.destination.trim(),
    candidates: input.pool,
    next_stop: {
      name: nextEnriched.name,
      kind: nextEnriched.kind,
      ...(nextEnriched.meal_slot ? { meal_slot: nextEnriched.meal_slot } : {}),
      ...stopPointerFields(nextEnriched),
    },
    ...tripLedgerFields(input.tripId, input.revision),
    transit_preference: input.criteria.transport,
    day_index: input.dayIndex,
    day_stops: input.skDay.stops,
    used_restaurant_names: input.usedRestaurantNames ?? [],
    ...(pace ? { pace } : {}),
    ...(budget ? { budget } : {}),
  };

  if (input.lookahead) {
    const look = enrichStopFromPool(input.lookahead, input.pool);
    body.lookahead_stop = {
      name: look.name,
      kind: look.kind ?? "attraction",
      ...stopPointerFields(look),
    };
  }

  if (input.isOriginStay) {
    body.origin_mode = true;
    body.time_from = normalizeAgentTime(input.criteria.timeFrom ?? "09:00");
    body.stay_role = input.stopIndex === 0 ? "day_origin" : "return";
  } else if (input.prevStop) {
    const prev = enrichStopFromPool(input.prevStop, input.pool);
    const endTime = input.prevEndTime ? normalizeAgentTime(input.prevEndTime) : undefined;
    body.current_stop = {
      name: prev.name,
      kind: prev.kind,
      ...(endTime ? { end_time: endTime } : {}),
      ...stopPointerFields(prev),
    };
    body.previous_stop = {
      name: prev.name,
      kind: prev.kind,
      ...(endTime ? { end_time: endTime } : {}),
    };
    if (endTime) body.arrival_clock = endTime;
  }

  let res = await planNextStop(body);
  if (!res.ok && res.outcome?.key === "errors.trip_revision_conflict" && input.tripId) {
    const details = await fetchTripDetails({
      trip_id: input.tripId,
      fields: ["skeleton", "cursor", "filled"],
      locale: input.opts.locale,
    });
    const { revision: nextRevision } = tripFetchSlice(details);
    const retryBody: Record<string, unknown> = {
      ...body,
      ...tripLedgerFields(input.tripId, nextRevision),
    };
    res = await planNextStop(retryBody);
  }
  if (!res.ok) return { ok: false, key: res.outcome?.key };
  const data = res.data as PlanNextStopData & {
    legs?: Array<{ mode?: string; duration_min?: number; recommended?: boolean }>;
    skeleton_patched?: boolean;
    meal_skipped?: boolean;
    patched_day_stops?: SkeletonStop[];
  };
  return {
    ok: true,
    display: data,
    legs: data.legs,
    tripId: data.trip_id ?? input.tripId,
    revision: data.revision ?? input.revision,
    skeletonPatched: data.skeleton_patched === true,
    mealSkipped: data.meal_skipped === true,
    patchedDayStops: Array.isArray(data.patched_day_stops) ? data.patched_day_stops : undefined,
  };
}

export function planPipelineMode(): "skeleton" | "legacy" {
  const raw = (process.env.PLAN_PIPELINE ?? "skeleton").toLowerCase();
  return raw === "legacy" ? "legacy" : "skeleton";
}
