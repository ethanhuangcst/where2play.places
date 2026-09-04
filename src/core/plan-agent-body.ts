import { coerceAgentTime } from "./coerce-agent-time";
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

export function mapPace(pace?: string): "tight" | "medium" | "relaxed" | undefined {
  if (!pace) return undefined;
  const p = pace.toLowerCase();
  if (/紧凑|tight|packed/.test(p)) return "tight";
  if (/轻松|relaxed|easy|leisure/.test(p)) return "relaxed";
  if (/适中|medium|moderate|mid|balanced/.test(p)) return "medium";
  return undefined;
}

export function mapSpend(budget?: string): "budget" | "premium" | undefined {
  if (!budget) return undefined;
  const b = budget.toLowerCase();
  if (b === "economy" || /经济|budget|cheap|economy/.test(b)) return "budget";
  if (b === "comfort" || /舒适|premium|luxury|高|comfort/.test(b)) return "premium";
  return undefined;
}

/** Normalize times to HH:MM (F77). */
export function normalizeAgentTime(raw: string): string {
  return coerceAgentTime(raw, "09:00");
}

function transitPreferred(transport?: string): boolean | undefined {
  if (!transport) return undefined;
  if (/步行优先|walk/.test(transport)) return false;
  if (/捷运|metro|transit|公交|bus/.test(transport)) return true;
  return undefined;
}

function boundsFromCriteria(criteria: PlanBoundaries): { start: string; end: string } {
  const start = criteria.startDate;
  const end = ymdPlusDays(start, Math.max(0, criteria.days - 1));
  return { start, end };
}

/**
 * plan-14: join trip type / interests / constraints into ONE natural_language
 * string. Agent reads preferences.natural_language into the arrange prompt;
 * preferences.interests is an accepted-but-unused field there, so we never send it.
 */
/** Omit revision when absent or invalid — Zod rejects `null`. */
export function tripLedgerFields(
  tripId?: string,
  revision?: number,
): Record<string, string | number> {
  if (!tripId) return {};
  const fields: Record<string, string | number> = { trip_id: tripId };
  if (typeof revision === "number" && Number.isInteger(revision) && revision > 0) {
    fields.revision = revision;
  }
  return fields;
}

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
    ...(criteria.mustInclude?.length ? { must_include: criteria.mustInclude } : {}),
  };
}

/** Intake-resolved origin, or name-only. Never geocode hotel without city. */
export function originFromPlanCriteria(
  criteria: PlanBoundaries,
): { name: string; lat?: number; lng?: number } | undefined {
  const name = criteria.dailyStart?.trim();
  if (!name) return undefined;
  if (typeof criteria.originLat === "number" && typeof criteria.originLng === "number") {
    return { name, lat: criteria.originLat, lng: criteria.originLng };
  }
  return { name };
}

export function buildMakeItineraryBody(
  criteria: PlanBoundaries,
  opts: {
    locale: string;
    providers: string[];
    candidates: { places: unknown[]; restaurants: unknown[] };
    origin?: { name: string; lat?: number; lng?: number };
    tripId?: string;
    revision?: number;
  },
): Record<string, unknown> {
  const origin =
    opts.origin ?? originFromPlanCriteria(criteria) ?? { name: criteria.destination };
  const pace = mapPace(criteria.pace);
  const budget = mapSpend(criteria.budget);

  return {
    city: criteria.destination.trim(),
    numDays: Math.max(1, criteria.days),
    candidates: opts.candidates,
    locale: opts.locale,
    providers: opts.providers,
    origin,
    ...(pace ? { pace } : {}),
    ...(budget ? { budget } : {}),
    ...(criteria.mustInclude?.length ? { must_include: criteria.mustInclude } : {}),
    natural_language: buildNaturalLanguage(criteria),
    ...tripLedgerFields(opts.tripId, opts.revision),
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
  if (criteria.timeFrom) preferences.time_from = normalizeAgentTime(criteria.timeFrom);
  if (criteria.timeTo) preferences.time_to = normalizeAgentTime(criteria.timeTo);
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
