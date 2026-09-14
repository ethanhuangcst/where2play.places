import { z } from "zod";
import type { PlanBoundaries } from "./itinerary-types";
import { normalizeBudgetKey } from "./plan-budget";
import { normalizeTransitKey } from "./plan-transit";

export const planTripBffBody = z.object({
  city: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  days: z.number().int().min(1).max(14),
  partySize: z.number().int().min(1).max(20),
  budget: z.string().trim().min(1),
  tripType: z.string().trim().min(1),
  pace: z.enum(["tight", "medium", "relaxed"]),
  transit: z.enum(["transit_walk", "drive_walk"]),
  locale: z.enum(["EN", "CN", "HK", "TW"]).optional(),
  trip_id: z.string().min(1).optional(),
  revision: z.number().int().positive().optional(),
  originName: z.string().trim().optional(),
  mustInclude: z.array(z.string().min(1)).optional(),
  startTime: z.string().trim().optional(),
  other: z.string().trim().optional(),
  /** MVP-T3: agent stops after skeleton make/commit. */
  skeleton_only: z.boolean().optional(),
  /** Mid-plan answers (e.g. expand_radius yes/no — 2play-plan-104). */
  answers: z
    .object({
      expand_radius: z.enum(["yes", "no"]).optional(),
    })
    .optional(),
});

export type PlanTripBffBody = z.infer<typeof planTripBffBody>;

/** Map takeoff POST body + agent trip ledger onto 2play session criteria. */
export function criteriaFromPlanTripBody(
  input: PlanTripBffBody,
  trip: { trip_id: string; revision?: number },
): PlanBoundaries {
  return {
    destination: input.city,
    startDate: input.startDate,
    days: input.days,
    partySize: input.partySize,
    budget: input.budget,
    tripType: input.tripType,
    pace: input.pace,
    transport: input.transit,
    locale: input.locale,
    tripId: trip.trip_id,
    ...(typeof trip.revision === "number" ? { revision: trip.revision } : {}),
  };
}

/**
 * Stable catalog key for agent L3 (`economy` | `mid` | `luxury` | `comfort`).
 * Do not collapse mid/comfort → `premium` (that rendered as 豪华).
 */
export function mapBudgetToAgent(budget: string): string {
  const raw = budget.trim().toLowerCase();
  if (raw === "comfort") return "comfort";
  const key = normalizeBudgetKey(budget);
  if (key) return key;
  if (raw === "budget" || raw === "$") return "economy";
  if (raw === "premium") return "luxury";
  return budget.trim();
}

/** Inclusive end date: startDate + (days - 1), noon UTC to avoid DST edge cases. */
export function planTripBoundsEnd(startDate: string, days: number): string {
  const start = startDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(days) || days < 1) {
    return start;
  }
  const d = new Date(`${start}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + (Math.round(days) - 1));
  return d.toISOString().slice(0, 10);
}

/** Pass stable keys so agent renders L3 labels (2play-plan-99). */
export function toAgentPlanTripBody(input: PlanTripBffBody): Record<string, unknown> {
  const transitKey = normalizeTransitKey(input.transit) || input.transit;
  const body: Record<string, unknown> = {
    city: input.city,
    locale: input.locale,
    numDays: input.days,
    pace: input.pace,
    budget: mapBudgetToAgent(input.budget),
    trip_type: input.tripType,
    party_size: input.partySize,
    transit_preference: transitKey,
    bounds: {
      start: input.startDate,
      end: planTripBoundsEnd(input.startDate, input.days),
    },
  };
  if (input.trip_id) body.trip_id = input.trip_id;
  if (input.revision) body.revision = input.revision;
  if (input.originName) body.origin = { name: input.originName };
  if (input.mustInclude?.length) body.must_include = input.mustInclude;
  if (input.startTime?.trim()) body.start_time = input.startTime.trim();
  if (input.other?.trim()) body.other = input.other.trim();
  if (input.skeleton_only === true) body.skeleton_only = true;
  if (input.answers && Object.keys(input.answers).length > 0) {
    body.answers = { ...input.answers };
  }
  return body;
}
