import type { ItineraryDto, ItineraryDayDto, ItinerarySlot, PlanBoundaries } from "./itinerary-types";
import type { SlotPreviewPayload } from "./itinerary-map";
import {
  buildDiscoverPlacesBody,
  buildMakeItineraryBody,
  normalizeAgentTime,
  planDayDates,
  tripLedgerFields,
} from "./plan-agent-body";
import { previewForSkeletonStop, previewForTransitLeg } from "./plan-slot-preview";
import {
  discoverPlaces,
  makeItinerary,
  planNextStop,
  fetchTripDetails,
  travelTips,
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
  | { type: "error"; key: string };

type SkeletonStop = { name: string; kind?: string; meal_slot?: string };
type SkeletonDay = { day_index: number; day_theme?: string; stops: SkeletonStop[] };
type Skeleton = { days: SkeletonDay[] };

type CandidatePools = { places: unknown[]; restaurants: unknown[] };

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
};

export async function* planItinerarySkeletonFill(
  criteria: PlanBoundaries,
  opts: { locale: string; providers: string[] },
): AsyncGenerator<SkeletonPlanProgressEvent> {
  const t = tt(opts.locale);
  let itinerary = emptyItinerary(criteria);
  const daysTotal = Math.max(1, criteria.days);

  yield { type: "phase", phase: "discovering" };

  let origin: { name: string; lat?: number; lng?: number } | undefined;
  if (criteria.dailyStart?.trim()) {
    origin = {
      name: criteria.dailyStart.trim(),
      ...(typeof criteria.originLat === "number" && typeof criteria.originLng === "number"
        ? { lat: criteria.originLat, lng: criteria.originLng }
        : {}),
    };
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

  if (!pool.places.length) {
    yield { type: "error", key: "errors.empty_results" };
    return;
  }

  if (tripId) {
    yield { type: "ledger", tripId, revision };
  }

  yield { type: "phase", phase: "skeleton" };

  const mkBody = buildMakeItineraryBody(criteria, {
    ...opts,
    candidates: slimPool(pool),
    ...(origin ? { origin } : {}),
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
    const key =
      tripId && (!mk.ok || !mk.data)
        ? "play.plan.phase_make_timeout"
        : mk.outcome?.key ?? "errors.make_itinerary_failed";
    yield { type: "error", key };
    return;
  }

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
      providers: opts.providers,
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

  for (const skDay of skeleton.days) {
    const dayIndex = skDay.day_index;
    yield { type: "phase", phase: "filling", dayIndex, daysTotal };

    let daySlots: ItinerarySlot[] = [];
    let prevEndTime: string | undefined;
    let prevStop: SkeletonStop | undefined;

    for (let stopIndex = 0; stopIndex < skDay.stops.length; stopIndex++) {
      const stop = skDay.stops[stopIndex]!;
      const isOriginStay = stopIndex === 0 && stop.kind === "stay";

      yield {
        type: "slot_preview",
        dayIndex,
        ...previewForSkeletonStop(stop, t),
      };

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
      });
      if (!fill.ok) {
        yield { type: "error", key: fill.key ?? "errors.provider_failed" };
        return;
      }
      tripId = fill.tripId ?? tripId;
      revision = fill.revision ?? revision;
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

      if (!isOriginStay && fill.legs?.length) {
        yield {
          type: "slot_preview",
          dayIndex,
          ...previewForTransitLeg(stop.name, fill.legs, t),
        };
        const transitSlot = mapLegsToTransitSlot(fill.legs, t);
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

      const placeSlot = mapStopDisplayToPlaceSlot(fill.display ?? {}, t);
      daySlots = [...daySlots, placeSlot];
      prevEndTime = fill.display?.slot?.end
        ? normalizeAgentTime(fill.display.slot.end)
        : prevEndTime;
      prevStop = stop;

      itinerary = mergeDay(itinerary, {
        dayIndex,
        highlights: skeletonDayHighlights(dayIndex, skDay.day_theme, t),
        slots: daySlots,
        meta: { window: dates[dayIndex - 1] },
      });
      yield { type: "stop_filled", dayIndex, stopIndex, slot: placeSlot, itinerary };
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
  opts: { locale: string; providers: string[] };
  prevStop?: SkeletonStop;
  prevEndTime?: string;
  isOriginStay: boolean;
  tripId?: string;
  revision?: number;
}): Promise<{
  ok: boolean;
  key?: string;
  display?: StopDisplayPayload;
  legs?: Array<{ mode?: string; duration_min?: number; recommended?: boolean }>;
  tripId?: string;
  revision?: number;
}> {
  const body: Record<string, unknown> = {
    locale: input.opts.locale,
    providers: input.opts.providers,
    city: input.criteria.destination.trim(),
    candidates: input.pool,
    next_stop: {
      name: input.stop.name,
      kind: input.stop.kind,
      ...(input.stop.meal_slot ? { meal_slot: input.stop.meal_slot } : {}),
    },
    ...tripLedgerFields(input.tripId, input.revision),
    transit_preference: input.criteria.transport,
  };

  if (input.isOriginStay) {
    body.origin_mode = true;
    body.time_from = normalizeAgentTime(input.criteria.timeFrom ?? "09:00");
    body.stay_role = input.stopIndex === 0 ? "day_origin" : "return";
  } else if (input.prevStop) {
    const endTime = input.prevEndTime ? normalizeAgentTime(input.prevEndTime) : undefined;
    body.current_stop = {
      name: input.prevStop.name,
      kind: input.prevStop.kind,
      ...(endTime ? { end_time: endTime } : {}),
    };
    body.previous_stop = {
      name: input.prevStop.name,
      kind: input.prevStop.kind,
      ...(endTime ? { end_time: endTime } : {}),
    };
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
  };
  return {
    ok: true,
    display: data,
    legs: data.legs,
    tripId: data.trip_id ?? input.tripId,
    revision: data.revision ?? input.revision,
  };
}

export function planPipelineMode(): "skeleton" | "legacy" {
  const raw = (process.env.PLAN_PIPELINE ?? "skeleton").toLowerCase();
  return raw === "legacy" ? "legacy" : "skeleton";
}
