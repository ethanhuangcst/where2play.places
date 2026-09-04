import type { ItineraryDto, PlanBoundaries } from "./itinerary-types";
import { fetchTripDetails } from "../places-agent/client";
import { tripFetchSlice } from "./plan-fetch-trip";
import { skeletonDayHighlights } from "./itinerary-skeleton-map";
import { t as catalogT } from "../i18n/catalog";
import { normalizeLocale, type Locale } from "./locales";
import { prisma } from "../db/client";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type PlanLedger = {
  tripId?: string;
  revision?: number;
};

type SkeletonDay = {
  day_index: number;
  day_theme?: string;
  stops?: { name: string; kind?: string }[];
};

export function emptyPlanItinerary(criteria: PlanBoundaries): ItineraryDto {
  return emptyItinerary(criteria);
}

export async function upsertPlanSessionCache(
  userId: string,
  criteria: PlanBoundaries,
  itinerary: ItineraryDto,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.planSessionCache.upsert({
    where: { userId },
    create: {
      userId,
      criteriaJson: criteria as object,
      itineraryJson: itinerary as object,
      expiresAt,
    },
    update: {
      criteriaJson: criteria as object,
      itineraryJson: itinerary as object,
      expiresAt,
    },
  });
}

function emptyItinerary(criteria: PlanBoundaries): ItineraryDto {
  return {
    title: criteria.destination,
    destination: criteria.destination,
    daysCount: Math.max(1, criteria.days),
    updatedAt: new Date().toISOString(),
    days: [],
  };
}

export function mergePlanCriteria(criteria: PlanBoundaries, ledger: PlanLedger): PlanBoundaries {
  const next: PlanBoundaries = { ...criteria };
  if (ledger.tripId) next.tripId = ledger.tripId;
  if (typeof ledger.revision === "number") next.revision = ledger.revision;
  return next;
}

export function extractPlanLedgerFromEvent(event: {
  type: string;
  tripId?: string;
  revision?: number;
}): PlanLedger | null {
  if (event.type === "ledger") {
    return { tripId: event.tripId, revision: event.revision };
  }
  if (event.type === "skeleton_done" && event.tripId) {
    return { tripId: event.tripId, revision: event.revision };
  }
  return null;
}

export function shouldPersistPlanCacheEvent(event: { type: string }): boolean {
  switch (event.type) {
    case "progress":
    case "day_done":
    case "done":
    case "skeleton_start":
    case "skeleton_day":
    case "skeleton_done":
    case "stop_filled":
    case "transit":
      return true;
    default:
      return false;
  }
}

function asSkeletonDays(raw: unknown): SkeletonDay[] {
  if (!raw || typeof raw !== "object") return [];
  const days = (raw as { days?: unknown }).days;
  return Array.isArray(days) ? (days as SkeletonDay[]) : [];
}

export function itineraryFromSkeletonFetch(
  criteria: PlanBoundaries,
  skeletonRaw: unknown,
  cached: ItineraryDto | null,
  locale: Locale | string,
): ItineraryDto {
  const t = (key: string, vars?: Record<string, string>) =>
    catalogT(normalizeLocale(String(locale)), key, vars);
  const skeletonDays = asSkeletonDays(skeletonRaw);
  if (!skeletonDays.length) {
    return cached ?? emptyItinerary(criteria);
  }

  const days = skeletonDays.map((skDay) => {
    const dayIndex = skDay.day_index;
    const cachedDay = cached?.days.find((d) => d.dayIndex === dayIndex);
    if (cachedDay && cachedDay.slots.length > 0) {
      return cachedDay;
    }
    return {
      dayIndex,
      highlights: skeletonDayHighlights(dayIndex, skDay.day_theme, t),
      slots: [] as ItineraryDto["days"][number]["slots"],
    };
  });

  days.sort((a, b) => a.dayIndex - b.dayIndex);
  return {
    title: criteria.destination,
    destination: criteria.destination,
    daysCount: Math.max(criteria.days, days.length),
    updatedAt: new Date().toISOString(),
    days,
  };
}

export async function refreshItineraryFromTripLedger(opts: {
  criteria: PlanBoundaries;
  cached: ItineraryDto | null;
  locale: string;
}): Promise<{ criteria: PlanBoundaries; itinerary: ItineraryDto } | null> {
  const tripId = opts.criteria.tripId;
  if (!tripId) return null;

  const fetched = await fetchTripDetails({
    trip_id: tripId,
    fields: ["skeleton", "filled"],
    locale: opts.locale,
    ...(typeof opts.criteria.revision === "number" ? { revision: opts.criteria.revision } : {}),
  });
  if (!fetched.ok) return null;

  const { slice, revision } = tripFetchSlice(fetched);
  const criteria = mergePlanCriteria(opts.criteria, {
    tripId,
    revision: typeof revision === "number" ? revision : opts.criteria.revision,
  });
  const itinerary = itineraryFromSkeletonFetch(criteria, slice.skeleton, opts.cached, opts.locale);
  return { criteria, itinerary };
}
