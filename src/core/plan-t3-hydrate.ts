import type { ItineraryDayDto, ItineraryDto, PlanBoundaries } from "./itinerary-types";
import { skeletonDayHighlights } from "./itinerary-skeleton-map";

type SkeletonStop = { name: string; kind?: string; meal_slot?: string };
type SkeletonDay = { day_index: number; day_theme?: string; stops: SkeletonStop[] };

/** Boundary non-conformance from agent skeleton (agent-discover-110c / 2play-plan-103). */
export type SkeletonDeviation = {
  field: string;
  expected: string;
  actual: string;
  reason: string;
};

export type T3SkeletonPreviewDay = {
  dayIndex: number;
  theme?: string;
  stops: { name: string; kind?: string; mealSlot?: string; filled?: boolean; pending?: boolean }[];
};

function asSkeletonDeviations(raw: unknown): SkeletonDeviation[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { deviations?: unknown }).deviations;
  if (!Array.isArray(list) || list.length === 0) return [];
  const out: SkeletonDeviation[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const field = typeof d.field === "string" ? d.field.trim() : "";
    const reason = typeof d.reason === "string" ? d.reason.trim() : "";
    if (!field && !reason) continue;
    out.push({
      field,
      expected: typeof d.expected === "string" ? d.expected : "",
      actual: typeof d.actual === "string" ? d.actual : "",
      reason,
    });
  }
  return out;
}

export function asAgentSkeleton(raw: unknown): { days: SkeletonDay[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const days = (raw as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length === 0) return null;
  return { days: days as SkeletonDay[] };
}

/** Map agent skeleton JSON → assistant preview days + empty-slot itinerary shell. */
export function hydrateFromAgentSkeleton(
  criteria: PlanBoundaries,
  raw: unknown,
  t: (key: string, vars?: Record<string, string>) => string,
): {
  itinerary: ItineraryDto;
  skeletonDays: T3SkeletonPreviewDay[];
  deviations: SkeletonDeviation[];
} | null {
  const skeleton = asAgentSkeleton(raw);
  if (!skeleton) return null;

  const skeletonDays: T3SkeletonPreviewDay[] = skeleton.days
    .map((skDay) => ({
      dayIndex: skDay.day_index,
      theme: skDay.day_theme,
      stops: (skDay.stops ?? []).map((s) => ({
        name: s.name,
        kind: s.kind,
        mealSlot: s.meal_slot,
        filled: true,
      })),
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);

  const days: ItineraryDayDto[] = skeletonDays.map((d) => ({
    dayIndex: d.dayIndex,
    highlights: skeletonDayHighlights(d.dayIndex, d.theme, t),
    slots: [],
  }));

  return {
    itinerary: {
      title: criteria.destination,
      destination: criteria.destination,
      daysCount: criteria.days,
      updatedAt: new Date().toISOString(),
      days,
    },
    skeletonDays,
    deviations: asSkeletonDeviations(raw),
  };
}

/** Visible T3 phases only — trip_created / debug hint removed (user order 2026-09-10). */
export const T3_PROGRESS_STEPS = [
  "skeleton_generating",
  "skeleton_ready",
] as const;

export type T3ProgressStepId = (typeof T3_PROGRESS_STEPS)[number];

export type T3ProgressStepState = "done" | "current" | "pending";

export function t3ProgressStepStates(
  phases: Array<{ phase: string }> | undefined,
  opts?: { failed?: boolean },
): Array<{ id: T3ProgressStepId; state: T3ProgressStepState }> {
  const seen = new Set((phases ?? []).map((p) => p.phase));
  const ready = seen.has("skeleton_ready");
  const failed = Boolean(opts?.failed) || seen.has("failed");
  // Agent may still emit trip_created; treat it as generating start for UI.
  const generating =
    seen.has("skeleton_generating") ||
    seen.has("trip_created") ||
    ready;

  return T3_PROGRESS_STEPS.map((id) => {
    if (id === "skeleton_generating") {
      if (ready) return { id, state: "done" as const };
      // Do not leave「正在生成框架」current after timeout/fail — looked like a hang.
      if (failed) return { id, state: "done" as const };
      if (generating) return { id, state: "current" as const };
      return { id, state: "pending" as const };
    }
    // skeleton_ready
    if (ready) return { id, state: "done" as const };
    if (failed) return { id, state: "pending" as const };
    if (generating) return { id, state: "pending" as const };
    return { id, state: "pending" as const };
  });
}

const DEVIATION_FIELD_KEYS: Record<string, string> = {
  far_cluster: "play.plan.deviation_field.far_cluster",
  attraction_pool: "play.plan.deviation_field.attraction_pool",
  day_count: "play.plan.deviation_field.day_count",
  pace: "play.plan.deviation_field.pace",
};

/** Localize a known deviation field; fall back to the raw field id. */
export function deviationFieldLabel(
  field: string,
  t: (key: string) => string,
): string {
  const key = DEVIATION_FIELD_KEYS[field];
  return key ? t(key) : field;
}

/** Agent machine reasons → locale keys (raw English stays internal). */
const DEVIATION_REASON_KEYS: Record<string, string> = {
  far_cluster_shared_day: "play.plan.deviation_reason.far_cluster_shared_day",
  attraction_pool_thin: "play.plan.deviation_reason.attraction_pool_thin",
  day_count_mismatch: "play.plan.deviation_reason.day_count_mismatch",
  // Legacy English sentences (agent <2026-09-14) — same keys for in-flight trips.
  "geographically far attraction clusters share a day; validate-don't-repair left the LLM day layout unchanged (no silent day-add)":
    "play.plan.deviation_reason.far_cluster_shared_day",
  "insufficient grounded attractions for requested trip length":
    "play.plan.deviation_reason.attraction_pool_thin",
  "skeleton day count does not match requested numDays":
    "play.plan.deviation_reason.day_count_mismatch",
};

/** Machine-key → interpolating locale key by deviation field. */
export const DEVIATION_REASON_KEY_BY_FIELD: Record<string, string> = {
  far_cluster: "play.plan.deviation_reason.far_cluster_shared_day",
  attraction_pool: "play.plan.deviation_reason.attraction_pool_thin",
  day_count: "play.plan.deviation_reason.day_count_mismatch",
};

/**
 * Parse agent `actual` into interpolation vars for the friendly reason lines.
 * far_cluster: "day 1 co-schedules far cluster(s): Sintra, Cascais"
 * day_count: expected/actual are bare numbers.
 */
export function parseDeviationDetail(
  d: SkeletonDeviation,
): Record<string, string> | null {
  if (d.field === "far_cluster") {
    const m = /^day (\d+) co-schedules far cluster\(s\): (.+)$/.exec(d.actual.trim());
    if (m) return { day: m[1], places: m[2] };
    return null;
  }
  if (d.field === "day_count") {
    if (d.expected && d.actual) return { expected: d.expected, actual: d.actual };
    return null;
  }
  return null;
}

/** Localize a known machine reason; fall back to the raw reason string. */
export function deviationReasonLabel(
  reason: string,
  t: (key: string) => string,
): string {
  const trimmed = reason.trim();
  // Stable machine keys (agent ≥2026-09-14) and legacy English sentences map to the same key.
  const key = DEVIATION_REASON_KEYS[trimmed];
  return key ? t(key) : trimmed;
}

