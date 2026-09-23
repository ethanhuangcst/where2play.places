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
  visaRequirement,
  geocode,
  reverseGeocode,
  type AgentEnvelope,
} from "../places-agent/client";
import { isResolvablePlaceNativeId } from "./place-native-id";
import {
  mapLegsToTransitSlot,
  mapStopDisplayToPlaceSlot,
  mapFilledStopToDisplay,
  coalesceStopDisplayWithPhotos,
  skeletonDayHighlights,
  type StopDisplayPayload,
} from "./itinerary-skeleton-map";
import {
  tripFetchSlice,
  candidatesFromSlice,
  skeletonStopCount,
  skeletonIsFillable,
  latestFilledStopFromSlice,
  travelTipsPayloadFromSlice,
  VISA_NOTICE_UNAVAILABLE,
} from "./plan-fetch-trip";
import { alpha2ToAlpha3 } from "./country-codes";
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
  | { type: "done"; itinerary: ItineraryDto; tripId?: string; revision?: number }
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
  if (stop.native_id && isResolvablePlaceNativeId(stop.provider, stop.native_id)) {
    out.native_id = stop.native_id;
  }
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
    nativeId: isResolvablePlaceNativeId(enriched.provider, enriched.native_id)
      ? enriched.native_id
      : undefined,
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
  origin: { lat?: number; lng?: number; native_id?: string; provider?: string } | undefined,
): void {
  if (typeof origin?.lat !== "number" || typeof origin?.lng !== "number") return;
  for (const day of skeleton.days) {
    for (const stop of day.stops) {
      if (stop.kind !== "stay") continue;
      if (typeof stop.lat !== "number" || typeof stop.lng !== "number") {
        stop.lat = origin.lat;
        stop.lng = origin.lng;
      }
      if (origin.native_id && !stop.native_id) stop.native_id = origin.native_id;
      if (origin.provider && !stop.provider) stop.provider = origin.provider;
    }
  }
}

/** Put origin stay in the fill pool so plan_next_stop can copy photos / skip lodging re-search. */
function injectOriginStayIntoPool(
  pool: CandidatePools,
  origin: {
    name: string;
    lat?: number;
    lng?: number;
    provider?: string;
    native_id?: string;
  },
  extra?: {
    photos?: string[];
    sources?: Array<{ provider?: string; native_id?: string; deeplinks?: Record<string, string> }>;
  },
): void {
  const name = origin.name?.trim();
  if (!name) return;
  const sources =
    extra?.sources ??
    (origin.native_id
      ? [
          {
            provider: origin.provider ?? "GOOGLE_MAPS",
            native_id: origin.native_id,
            deeplinks: {},
          },
        ]
      : undefined);
  const card: CandidatePools["places"][number] = {
    name,
    ...(origin.provider ? { provider: origin.provider } : {}),
    ...(typeof origin.lat === "number" && typeof origin.lng === "number"
      ? { location: { lat: origin.lat, lng: origin.lng, crs: "WGS84" } }
      : {}),
    ...(extra?.photos?.length ? { photos: extra.photos } : {}),
    ...(sources?.length ? { sources } : {}),
  };
  pool.places = [card, ...pool.places.filter((p) => (p as { name?: string }).name !== name)];
}

function slimPool(pool: CandidatePools): CandidatePools {
  const slim = (c: Record<string, unknown>) => {
    const o: Record<string, unknown> = { name: c.name };
    if (c.location) o.location = c.location;
    if (c.sources) o.sources = c.sources;
    if (c.provider) o.provider = c.provider;
    if (c.rating !== undefined) o.rating = c.rating;
    if (c.user_ratings_total !== undefined) o.user_ratings_total = c.user_ratings_total;
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

/** Skip redundant fetch `filled` when plan_next_stop envelope is already authoritative. */
export function envelopeIsFillComplete(display: StopDisplayPayload | undefined): boolean {
  if (!display?.stop?.name || !display?.slot) return false;
  const card = display.stop.card;
  if (card?.photos?.some((p) => typeof p === "string" && p.startsWith("http"))) return true;
  if (card?.sources?.some((s) => s?.native_id?.trim())) return true;
  if (display.stop.kind === "stay") return true;
  return false;
}

export async function* planItinerarySkeletonFill(
  criteria: PlanBoundaries,
  opts: { locale: string; providers?: string[] },
): AsyncGenerator<SkeletonPlanProgressEvent> {
  const t = tt(opts.locale);
  let itinerary = emptyItinerary(criteria);
  const daysTotal = Math.max(1, criteria.days);
  const fillOnly = criteria.planMode === "fill" && Boolean(criteria.tripId?.trim());

  // 94a: ensure dest ISO3 before visa write (geocode country_code or reverse pin).
  const resolvedDest = await resolveDestinationCountryAlpha3(criteria, opts.locale);
  if (resolvedDest) {
    criteria = { ...criteria, destinationCountryAlpha3: resolvedDest };
  }

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
  } else if (!fillOnly) {
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
  let skeleton: Skeleton | null = null;

  if (fillOnly && tripId) {
    // MVP-T5: resume fill from T3 skeleton — do not remake.
    const fetched = await fetchTripDetails({
      trip_id: tripId,
      fields: ["skeleton", "candidates", "constraints"],
      locale: opts.locale,
    });
    if (!fetched.ok) {
      yield { type: "error", key: fetched.outcome?.key ?? "errors.provider_failed" };
      return;
    }
    const { slice, revision: nextRev } = tripFetchSlice(fetched);
    if (typeof nextRev === "number") revision = nextRev;
    const fromStore = candidatesFromSlice(slice);
    if (fromStore) {
      pool.places = fromStore.places;
      pool.restaurants = fromStore.restaurants;
    }
    skeleton = asSkeleton(slice.skeleton);
    if (!skeleton?.days?.length || !skeletonIsFillable(skeleton)) {
      yield { type: "error", key: "play.plan.assistant_fetch_failed" };
      return;
    }
    // Prefer stay coords + pointer from constraints.originStay (ADR-053) so day 2+
    // origin_mode does not re-search lodging (slow) and stay thumbs resolve from pool.
    const constraints = slice.constraints as
      | {
          origin?: { name?: string; lat?: number; lng?: number };
          originStay?: {
            name?: string;
            provider?: string;
            photos?: string[];
            location?: { lat?: number; lng?: number };
            sources?: Array<{ provider?: string; native_id?: string; deeplinks?: Record<string, string> }>;
          };
        }
      | undefined;
    const originStayRaw = constraints?.originStay;
    if (originStayRaw?.name?.trim()) {
      const src = originStayRaw.sources?.find((s) => s.native_id?.trim());
      const nativeId = src?.native_id?.trim();
      const lat = originStayRaw.location?.lat ?? constraints?.origin?.lat;
      const lng = originStayRaw.location?.lng ?? constraints?.origin?.lng;
      origin = {
        name: originStayRaw.name.trim(),
        ...(typeof lat === "number" ? { lat } : {}),
        ...(typeof lng === "number" ? { lng } : {}),
        ...(originStayRaw.provider ? { provider: originStayRaw.provider } : {}),
        ...(nativeId ? { native_id: nativeId } : {}),
      };
      injectOriginStayIntoPool(pool, origin, {
        photos: Array.isArray(originStayRaw.photos)
          ? originStayRaw.photos.filter(
              (p): p is string => typeof p === "string" && p.startsWith("https://"),
            )
          : undefined,
        sources: Array.isArray(originStayRaw.sources) ? originStayRaw.sources : undefined,
      });
    } else if (constraints?.origin?.name?.trim()) {
      origin = {
        name: constraints.origin.name.trim(),
        ...(typeof constraints.origin.lat === "number" ? { lat: constraints.origin.lat } : {}),
        ...(typeof constraints.origin.lng === "number" ? { lng: constraints.origin.lng } : {}),
      };
      injectOriginStayIntoPool(pool, origin);
    }
    stampStayCoords(skeleton, origin);
    yield { type: "ledger", tripId, revision };
    yield { type: "phase", phase: "filling", dayIndex: 1, daysTotal };
  } else {
  yield { type: "phase", phase: "discovering" };

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
  } // end !fillOnly discover/make branch

  if (!fillOnly && tripId) {
    const visaRev = await writeArtifactsVisa({
      tripId,
      revision,
      locale: opts.locale,
      passport: criteria.passportAlpha3,
      destination: criteria.destinationCountryAlpha3,
    });
    if (typeof visaRev === "number") revision = visaRev;
  }

  if (!skeleton?.days?.length) {
    yield { type: "error", key: "play.plan.assistant_fetch_failed" };
    return;
  }

  // Ensure stay is in the fill pool for every day origin (avoids 30–100s lodging re-search).
  injectOriginStayIntoPool(pool, origin, {
    photos: Array.isArray(criteria.originStay?.photos)
      ? criteria.originStay.photos.filter(
          (p): p is string => typeof p === "string" && p.startsWith("https://"),
        )
      : undefined,
    sources:
      criteria.originStay?.native_id || criteria.originStay?.provider
        ? [
            {
              ...(criteria.originStay.provider ? { provider: criteria.originStay.provider } : {}),
              ...(criteria.originStay.native_id ? { native_id: criteria.originStay.native_id } : {}),
              deeplinks: {},
            },
          ]
        : undefined,
  });
  stampStayCoords(skeleton, origin);

  let lastTipsSig = "";
  let visaWrite: Promise<void> | undefined;

  async function pullNewTips(): Promise<Record<string, unknown> | null> {
    let payload: Record<string, unknown> | null = null;
    if (tripId) {
      const fetched = await fetchArtifactsTips(tripId, opts.locale);
      if (typeof fetched.revision === "number") revision = fetched.revision;
      payload = fetched.tips;
    }
    const notice = visaDegradeNotice(criteria);
    if (notice && payload?.visa == null && payload?.visa_notice == null) {
      payload = { ...(payload ?? {}), visa_notice: notice };
    }
    if (!payload) return null;
    const sig = JSON.stringify(payload);
    if (sig === lastTipsSig) return null;
    lastTipsSig = sig;
    return payload;
  }

  if (tripId && !fillOnly) {
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
    }
  }

  // Early fetch: show tips as soon as artifacts exist. Do not wait for visa or the fill loop.
  if (tripId) {
    let tips = await pullNewTips();
    if (!tips && fillOnly) {
      await sleep(120);
      tips = await pullNewTips();
    }
    if (tips) yield { type: "tips", data: tips };
  }

  if (fillOnly && tripId) {
    visaWrite = writeArtifactsVisa({
      tripId,
      revision,
      locale: opts.locale,
      passport: criteria.passportAlpha3,
      destination: criteria.destinationCountryAlpha3,
    })
      .then((rev) => {
        if (typeof rev === "number") revision = rev;
      })
      .catch(() => undefined);
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
    let patchAttempts = 0;

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
        // Hotel skip / stay-less day: agent requires current_stop unless origin_mode.
        dayOrigin: origin,
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
        patchAttempts += 1;
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
        // Cap retries when skeleton keeps changing to avoid infinite hang.
        if (beforeKey === afterKey || patchAttempts >= 3) {
          patchAttempts = 0;
          stopIndex += 1;
        }
        continue;
      }

      let filledDisplay: StopDisplayPayload | undefined;
      let filledLegs:
        | Array<{ mode?: string; duration_min?: number; recommended?: boolean }>
        | undefined;

      const envelopeDisplay = fill.display as StopDisplayPayload | undefined;
      const skipFilledFetch =
        !fill.skeletonPatched && envelopeIsFillComplete(envelopeDisplay);

      if (tripId && !skipFilledFetch) {
        const fetchedFill = await fetchTripDetails({
          trip_id: tripId,
          fields: ["filled", "cursor"],
          locale: opts.locale,
        });
        if (fetchedFill.ok) {
          const { slice, revision: r } = tripFetchSlice(fetchedFill);
          if (typeof r === "number") revision = r;
          const latest = latestFilledStopFromSlice(slice);
          if (latest?.stop || latest?.slot) {
            filledDisplay = mapFilledStopToDisplay(latest);
            if (latest.legs?.length) filledLegs = latest.legs;
          }
        }
      }

      // U2 SoT: prefer fetch filled; keep envelope card photos when filled omitted them.
      const displaySoT: StopDisplayPayload = coalesceStopDisplayWithPhotos(
        filledDisplay,
        envelopeDisplay,
      );
      const legsSoT = filledLegs ?? fill.legs;

      if (fill.mealSkipped) {
        const placeSlot = mapStopDisplayToPlaceSlot(
          {
            stop: {
              name: stop.meal_slot ?? stop.name,
              kind: "meal",
              card: null,
              deeplinks: {},
            },
            slot: displaySoT.slot ?? { start: prevEndTime ?? "12:00", end: prevEndTime ?? "12:00" },
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
        patchAttempts = 0;
        stopIndex += 1;
        continue;
      }

      if (!isOriginStay && legsSoT?.length) {
        yield {
          type: "slot_preview",
          dayIndex,
          ...previewForTransitLeg(stop.name, legsSoT, t),
        };
        const transitSlot = mapLegsToTransitSlot(legsSoT, t, {
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

      const placeSlot = mapStopDisplayToPlaceSlot(displaySoT, t, placeSlotMapOpts(stop, pool));
      daySlots = [...daySlots, placeSlot];
      prevEndTime = displaySoT.slot?.end
        ? normalizeAgentTime(displaySoT.slot.end)
        : prevEndTime;
      const venueLoc =
        (displaySoT.stop as { location?: { lat?: number; lng?: number } } | undefined)?.location ??
        (fill.display as PlanNextStopData | undefined)?.next_stop?.location;
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
      const midTips = await pullNewTips();
      if (midTips) yield { type: "tips", data: midTips };
      patchAttempts = 0;
      stopIndex += 1;
    }

    yield { type: "day_done", dayIndex, daysTotal, itinerary };
  }

  if (visaWrite) await visaWrite;
  if (tripId) {
    const late = await pullNewTips();
    if (late) yield { type: "tips", data: late };
  }

  yield { type: "done", itinerary, tripId, revision };
}

const VISA_NOTICE_NEED_NATIONALITY = "play.plan.travel_tips_visa_need_nationality";

/**
 * Resolve destination ISO alpha-3 for visa write.
 * Prefer explicit alpha-3 / alpha-2 from takeoff; else reverse/forward geocode.
 */
export async function resolveDestinationCountryAlpha3(
  criteria: PlanBoundaries,
  locale: string,
): Promise<string | undefined> {
  const existing = criteria.destinationCountryAlpha3?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{3}$/.test(existing)) return existing;

  const fromCode = alpha2ToAlpha3(criteria.destinationCountryCode);
  if (fromCode) return fromCode;

  function fromCountryCode(code: string | undefined): string | undefined {
    return alpha2ToAlpha3(code) ?? undefined;
  }

  if (
    typeof criteria.destinationLat === "number" &&
    typeof criteria.destinationLng === "number" &&
    Number.isFinite(criteria.destinationLat) &&
    Number.isFinite(criteria.destinationLng)
  ) {
    try {
      const hit = await reverseGeocode({
        lat: criteria.destinationLat,
        lng: criteria.destinationLng,
        locale,
      });
      const resolved = fromCountryCode(hit.data?.country_code);
      if (resolved) return resolved;
    } catch {
      /* fall through to forward geocode */
    }
  }

  const destName = criteria.destination?.trim();
  if (destName) {
    try {
      const hit = await geocode({ query: destName, locale });
      const resolved = fromCountryCode(hit.data?.country_code);
      if (resolved) return resolved;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/** 94c: honest degrade when visa cannot be shown (not home-country hide). */
function visaDegradeNotice(
  criteria: PlanBoundaries,
): { key: string; href?: string } | null {
  const destination = criteria.destinationCountryAlpha3?.trim().toUpperCase() ?? "";
  const passport = criteria.passportAlpha3?.trim().toUpperCase() ?? "";
  const destOk = /^[A-Z]{3}$/.test(destination);
  const passportOk = /^[A-Z]{3}$/.test(passport);
  // Home-country: hide (107) — no notice.
  if (destOk && passportOk && passport === destination) {
    return null;
  }
  if (destOk && !passportOk) {
    return { key: VISA_NOTICE_NEED_NATIONALITY, href: "/profile" };
  }
  // Passport known but dest ISO unresolved — unavailable (not blank card 01).
  if (!destOk && passportOk) {
    return { key: VISA_NOTICE_UNAVAILABLE };
  }
  // Neither code: hide (94c).
  return null;
}

async function writeArtifactsVisa(input: {
  tripId: string;
  revision?: number;
  locale: string;
  passport?: string;
  destination?: string;
}): Promise<number | undefined> {
  const passport = input.passport?.trim().toUpperCase() ?? "";
  const destination = input.destination?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}$/.test(passport) || !/^[A-Z]{3}$/.test(destination)) return input.revision;
  // 107: home-country travel — skip Orizn; do not invent visa-free days.
  if (passport === destination) return input.revision;
  try {
    const visa = await visaRequirement({
      passport,
      destination,
      trip_id: input.tripId,
      ...(typeof input.revision === "number" ? { revision: input.revision } : {}),
      locale: input.locale,
    });
    const rev = (visa.data as { revision?: number } | undefined)?.revision;
    return typeof rev === "number" ? rev : input.revision;
  } catch {
    return input.revision;
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArtifactsTips(
  tripId: string,
  locale: string,
): Promise<{ tips: Record<string, unknown> | null; revision?: number }> {
  const fetched = await fetchTripDetails({
    trip_id: tripId,
    fields: ["artifacts"],
    locale,
  });
  if (!fetched.ok) return { tips: null };
  const { slice, revision } = tripFetchSlice(fetched);
  return {
    tips: travelTipsPayloadFromSlice(slice),
    revision: typeof revision === "number" ? revision : undefined,
  };
}

/** Transient agent/BFF failures (e.g. tsx watch restart mid-fill). Do not retry validation errors. */
function isTransientPlanNextStopFailure(key: string | undefined): boolean {
  return key === "errors.provider_failed" || key === "errors.arrange_timeout";
}

function planNextStopRetryDelayMs(attempt: number): number {
  const raw = Number(process.env.PLAN_NEXT_STOP_RETRY_MS ?? 1_500);
  const base = Number.isFinite(raw) && raw >= 0 ? raw : 1_500;
  return base * (attempt + 1);
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
  /** Trip origin used when the day has no stay stop and no previous filled stop. */
  dayOrigin?: { name: string; lat?: number; lng?: number; provider?: string; native_id?: string };
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
  } else if (input.dayOrigin?.name?.trim()) {
    // Day starts on attraction/meal (hotel skipped or stay omitted) — seed clock from origin.
    const endTime = normalizeAgentTime(input.criteria.timeFrom ?? "09:00");
    const originStop: SkeletonStop = {
      name: input.dayOrigin.name.trim(),
      kind: "stay",
      ...(typeof input.dayOrigin.lat === "number" ? { lat: input.dayOrigin.lat } : {}),
      ...(typeof input.dayOrigin.lng === "number" ? { lng: input.dayOrigin.lng } : {}),
      ...(input.dayOrigin.provider ? { provider: input.dayOrigin.provider } : {}),
      ...(input.dayOrigin.native_id ? { native_id: input.dayOrigin.native_id } : {}),
    };
    body.current_stop = {
      name: originStop.name,
      kind: "stay",
      end_time: endTime,
      ...stopPointerFields(originStop),
    };
    body.previous_stop = {
      name: originStop.name,
      kind: "stay",
      end_time: endTime,
    };
    body.arrival_clock = endTime;
  }

  const hopStartedMs = Date.now();
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
  // Agent watch restarts / brief disconnects map to provider_failed — retry before aborting the trip.
  for (let attempt = 0; attempt < 2 && !res.ok && isTransientPlanNextStopFailure(res.outcome?.key); attempt++) {
    await sleep(planNextStopRetryDelayMs(attempt));
    res = await planNextStop(body);
  }
  if (!res.ok) return { ok: false, key: res.outcome?.key };
  const data = res.data as PlanNextStopData & {
    legs?: Array<{ mode?: string; duration_min?: number; recommended?: boolean }>;
    skeleton_patched?: boolean;
    meal_skipped?: boolean;
    patched_day_stops?: SkeletonStop[];
  };
  console.info(
    "plan_fill_stop",
    JSON.stringify({
      stop: input.stop.name,
      kind: input.stop.kind ?? "unknown",
      day_index: input.dayIndex,
      duration_ms: Date.now() - hopStartedMs,
      providers: input.opts.providers ?? [],
    }),
  );
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
