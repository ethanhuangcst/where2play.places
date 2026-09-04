import type { ItineraryDayDto, ItineraryDto, PlanBoundaries } from "./itinerary-types";
import { buildMakeItineraryBody } from "./plan-agent-body";
import { makeItinerary, fetchTripDetails } from "../places-agent/client";
import { skeletonDayHighlights } from "./itinerary-skeleton-map";
import {
  tripFetchSlice,
  candidatesFromSlice,
  skeletonIsFillable,
} from "./plan-fetch-trip";
import { t as catalogT } from "../i18n/catalog";
import type { SkeletonPlanProgressEvent } from "./plan-skeleton-fill";

type SkeletonStop = { name: string; kind?: string; meal_slot?: string };
type SkeletonDay = { day_index: number; day_theme?: string; stops: SkeletonStop[] };
type Skeleton = { days: SkeletonDay[] };

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

function asSkeleton(raw: unknown): Skeleton | null {
  if (!raw || typeof raw !== "object") return null;
  const days = (raw as { days?: unknown }).days;
  if (!Array.isArray(days)) return null;
  return { days: days as SkeletonDay[] };
}

function slimPool(places: unknown[], restaurants: unknown[]) {
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
    places: places.map((p) => slim(p as Record<string, unknown>)),
    restaurants: restaurants.map((p) => slim(p as Record<string, unknown>)),
  };
}

/**
 * Feature 41 Story 4: make_itinerary then fetch skeleton. No discover, no fill.
 */
export async function* planItinerarySkeletonOnly(
  criteria: PlanBoundaries,
  opts: { locale: string; providers: string[] },
): AsyncGenerator<SkeletonPlanProgressEvent> {
  const t = (key: string, vars?: Record<string, string>) => catalogT(opts.locale, key, vars);
  let itinerary = emptyItinerary(criteria);
  let tripId = criteria.tripId;
  let revision = criteria.revision;

  if (!tripId) {
    yield { type: "error", key: "errors.validation" };
    return;
  }

  yield { type: "phase", phase: "skeleton" };
  yield { type: "ledger", tripId, revision };

  let origin: { name: string; lat?: number; lng?: number } | undefined;
  if (criteria.dailyStart?.trim()) {
    origin = {
      name: criteria.dailyStart.trim(),
      ...(typeof criteria.originLat === "number" && typeof criteria.originLng === "number"
        ? { lat: criteria.originLat, lng: criteria.originLng }
        : {}),
    };
  }

  const fetchedPool = await fetchTripDetails({
    trip_id: tripId,
    fields: ["candidates"],
    locale: opts.locale,
  });
  let places: unknown[] = [];
  let restaurants: unknown[] = [];
  if (fetchedPool.ok) {
    const { slice, revision: nextRev } = tripFetchSlice(fetchedPool);
    const fromStore = candidatesFromSlice(slice);
    if (fromStore) {
      places = fromStore.places;
      restaurants = fromStore.restaurants;
    }
    if (typeof nextRev === "number") revision = nextRev;
  }
  if (!places.length) {
    yield { type: "error", key: "errors.empty_results" };
    return;
  }

  const makeBody = buildMakeItineraryBody(criteria, {
    ...opts,
    candidates: slimPool(places, restaurants),
    ...(origin ? { origin } : {}),
    tripId,
    revision,
  });
  const mk = await makeItinerary(makeBody);
  tripId = (mk.data as { trip_id?: string } | undefined)?.trip_id ?? tripId;
  revision = (mk.data as { revision?: number } | undefined)?.revision ?? revision;

  const fetched = tripId
    ? await fetchTripDetails({
        trip_id: tripId,
        fields: ["skeleton", "candidates", "constraints"],
        locale: opts.locale,
      })
    : { ok: false as const, agent: "places-agent" as const };
  let skeleton: Skeleton | null = null;
  if (fetched.ok) {
    const { slice, revision: nextRev } = tripFetchSlice(fetched);
    skeleton = asSkeleton(slice.skeleton);
    if (typeof nextRev === "number") revision = nextRev;
  }

  const fillable = skeletonIsFillable(skeleton);

  if (!skeleton || !fillable) {
    let key = "errors.make_itinerary_failed";
    if (!mk.ok) {
      key = mk.outcome?.key ?? "play.plan.assistant_make_failed";
    } else if (!fetched.ok) {
      key = "play.plan.assistant_fetch_failed";
    }
    yield { type: "error", key };
    return;
  }

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
  yield { type: "done", itinerary };
}
