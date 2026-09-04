/** Elapsed seconds for make progress, one decimal (e.g. 12.4). */
export function formatPlanElapsedSeconds(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return (safe / 1000).toFixed(1);
}

export function friendlyMakeErrorKey(raw: string | null | undefined): string {
  if (!raw) return "play.plan.assistant_make_failed";
  if (
    raw.includes("timeout") ||
    raw.includes("phase_make_timeout") ||
    raw === "play.plan.phase_make_timeout"
  ) {
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
