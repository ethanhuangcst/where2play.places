/** Elapsed seconds for make progress, one decimal (e.g. 12.4). */
export function formatPlanElapsedSeconds(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return (safe / 1000).toFixed(1);
}

/** True when the agent/BFF outcome is a real abort/timeout, not a generic make failure. */
export function isMakeTimeoutOutcome(key: string | null | undefined): boolean {
  if (!key) return false;
  return (
    key.includes("timeout") ||
    key.includes("phase_make_timeout") ||
    key === "play.plan.phase_make_timeout"
  );
}

/**
 * Choose NDJSON error key after make fails / skeleton unusable.
 * Timeout only for abort/timeout outcomes; otherwise make_failed (not "假超时").
 */
export function skeletonMakeErrorKey(opts: {
  makeOutcomeKey?: string | null;
}): string {
  const outcome = opts.makeOutcomeKey ?? null;
  if (isMakeTimeoutOutcome(outcome)) {
    return "play.plan.phase_make_timeout";
  }
  if (outcome) return outcome;
  return "errors.make_itinerary_failed";
}

export function friendlyMakeErrorKey(raw: string | null | undefined): string {
  if (!raw) return "play.plan.assistant_make_failed";
  if (isMakeTimeoutOutcome(raw)) {
    return "play.plan.assistant_make_timeout";
  }
  if (raw.includes("fetch")) {
    return "play.plan.assistant_fetch_failed";
  }
  if (raw.includes("make") || raw.includes("provider") || raw.includes("failed")) {
    return "play.plan.assistant_make_failed";
  }
  return raw.startsWith("play.") || raw.startsWith("errors.")
    ? raw
    : "play.plan.assistant_make_failed";
}
