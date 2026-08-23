import type { PlanBoundaries } from "./itinerary-types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse YYYY-MM-DD as local calendar date. */
export function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local calendar date YYYY-MM-DD for offset days from a base date (default today). */
export function localDatePlus(daysOffset: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Offset days from an explicit YYYY-MM-DD start. */
export function ymdPlusDays(startYmd: string, daysOffset: number): string {
  return localDatePlus(daysOffset, parseLocalYmd(startYmd));
}

function mapPace(pace?: string): "tight" | "medium" | "relaxed" | undefined {
  if (!pace) return undefined;
  const p = pace.toLowerCase();
  if (/紧凑|tight|packed/.test(p)) return "tight";
  if (/轻松|relaxed|easy|leisure/.test(p)) return "relaxed";
  if (/适中|medium|moderate/.test(p)) return "medium";
  return undefined;
}

function mapSpend(budget?: string): "budget" | "premium" | undefined {
  if (!budget) return undefined;
  const b = budget.toLowerCase();
  if (/经济|budget|cheap/.test(b)) return "budget";
  if (/舒适|premium|luxury|高/.test(b)) return "premium";
  return undefined;
}

function transitPreferred(transport?: string): boolean | undefined {
  if (!transport) return undefined;
  if (/步行优先|walk/.test(transport)) return false;
  if (/捷运|metro|transit|公交|bus/.test(transport)) return true;
  return undefined;
}

function boundsFromCriteria(criteria: PlanBoundaries): { start: string; end: string } {
  const start = criteria.startDate;
  const end = ymdPlusDays(start, Math.max(1, criteria.days));
  return { start, end };
}

/**
 * plan-14: join trip type / interests / constraints into ONE natural_language
 * string. Agent reads preferences.natural_language into the arrange prompt;
 * preferences.interests is an accepted-but-unused field there, so we never send it.
 */
export function buildNaturalLanguage(criteria: PlanBoundaries): string | undefined {
  const parts = [
    criteria.tripType,
    ...(criteria.interests ?? []),
    criteria.constraints,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export function buildPlanItineraryBody(
  criteria: PlanBoundaries,
  opts: { locale: string; providers: string[]; now?: Date },
): Record<string, unknown> {
  const { start, end } = boundsFromCriteria(criteria);

  const naturalParts = [
    criteria.destination,
    criteria.tripType,
    ...(criteria.interests ?? []),
    criteria.constraints,
  ].filter(Boolean);

  const origin = criteria.dailyStart
    ? { name: criteria.dailyStart }
    : { name: criteria.destination };

  const destination = criteria.dailyEnd
    ? { name: criteria.dailyEnd }
    : { name: criteria.destination };

  const preferences: Record<string, unknown> = {};
  const pace = mapPace(criteria.pace);
  const spend = mapSpend(criteria.budget);
  const transit = transitPreferred(criteria.transport);
  if (pace) preferences.pace = pace;
  if (spend) preferences.spend = spend;
  if (transit != null) preferences.transit_preferred = transit;
  if (naturalParts.length) preferences.natural_language = naturalParts.join(" · ");

  return {
    detail: "timed",
    origin,
    destination,
    bounds: { start, end },
    locale: opts.locale,
    providers: opts.providers,
    ...(criteria.partySize != null ? { party_size: criteria.partySize } : {}),
    ...(Object.keys(preferences).length ? { preferences } : {}),
  };
}

export function buildDiscoverPlacesBody(
  criteria: PlanBoundaries,
  opts: { locale: string; providers: string[]; now?: Date },
): Record<string, unknown> {
  const { start, end } = boundsFromCriteria(criteria);
  const origin = criteria.dailyStart
    ? { name: criteria.dailyStart }
    : { name: criteria.destination };

  return {
    city: criteria.destination.trim(),
    bounds: { start, end },
    origin,
    locale: opts.locale,
    providers: opts.providers,
    numDays: Math.max(1, criteria.days),
  };
}

export function buildArrangeDayBody(
  criteria: PlanBoundaries,
  opts: {
    locale: string;
    providers: string[];
    dayIndex: number;
    date: string;
    candidates: { places: unknown[]; restaurants: unknown[] };
    excludeNames?: string[];
    now?: Date;
  },
): Record<string, unknown> {
  const origin = criteria.dailyStart
    ? { name: criteria.dailyStart }
    : { name: criteria.destination };
  const destination = criteria.dailyEnd
    ? { name: criteria.dailyEnd }
    : { name: criteria.destination };
  const pace = mapPace(criteria.pace);
  const budget = mapSpend(criteria.budget);

  const preferences: Record<string, unknown> = {};
  if (criteria.timeFrom) preferences.time_from = criteria.timeFrom;
  if (criteria.timeTo) preferences.time_to = criteria.timeTo;
  const transit = transitPreferred(criteria.transport);
  if (transit != null) preferences.transit_preferred = transit;
  const naturalLanguage = buildNaturalLanguage(criteria);
  if (naturalLanguage) preferences.natural_language = naturalLanguage;

  return {
    candidates: opts.candidates,
    dayIndex: opts.dayIndex,
    date: opts.date,
    city: criteria.destination.trim(),
    origin,
    destination,
    locale: opts.locale,
    providers: opts.providers,
    ...(pace ? { pace } : {}),
    ...(budget ? { budget } : {}),
    ...(criteria.partySize != null ? { party_size: criteria.partySize } : {}),
    ...(opts.excludeNames?.length ? { exclude_names: opts.excludeNames } : {}),
    ...(Object.keys(preferences).length ? { preferences } : {}),
  };
}

/** Calendar dates for each planned day from startDate (1-based dayIndex → YYYY-MM-DD). */
export function planDayDates(days: number, startDate: string): string[] {
  return Array.from({ length: Math.max(1, days) }, (_, i) => ymdPlusDays(startDate, i));
}
