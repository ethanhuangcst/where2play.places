import type { SlotPreviewPayload } from "./itinerary-map";

type PreviewT = (key: string, vars?: Record<string, string>) => string;

export function formatSlotPreviewLine(preview: SlotPreviewPayload, t: PreviewT): string {
  if (preview.kind === "transit") {
    return t("play.plan.preview_transit", {
      label: preview.transportLabel ?? preview.name,
      reason: preview.reason,
      duration: preview.window,
    });
  }
  if (preview.kind === "meal") {
    const mealKey =
      preview.mealLabel === "dinner"
        ? "play.plan.meal_dinner"
        : preview.mealLabel === "afternoon_tea"
          ? "play.plan.meal_afternoon_tea"
          : "play.plan.meal_lunch";
    return t("play.plan.preview_meal", {
      meal: t(mealKey),
      name: preview.name,
      reason: preview.reason,
      window: preview.window,
    });
  }
  return t("play.plan.preview_place", {
    name: preview.name,
    reason: preview.reason,
    window: preview.window,
  });
}

export function previewForSkeletonStop(
  stop: { name: string; kind?: string; meal_slot?: string },
  t: PreviewT,
): SlotPreviewPayload {
  const reason = t("play.plan.preview_reason_skeleton");
  if (stop.meal_slot) {
    const mealLabel =
      stop.meal_slot === "lunch" || stop.meal_slot === "dinner" || stop.meal_slot === "afternoon_tea"
        ? stop.meal_slot
        : "lunch";
    return {
      kind: "meal",
      name: stop.name,
      reason,
      window: "…",
      mealLabel,
    };
  }
  return {
    kind: stop.kind === "stay" ? "place" : "place",
    name: stop.name,
    reason,
    window: "…",
  };
}

export function previewForTransitLeg(
  toName: string,
  legs: Array<{ mode?: string; duration_min?: number }> | undefined,
  t: PreviewT,
): SlotPreviewPayload {
  const durationMin = legs?.reduce((sum, leg) => sum + (leg.duration_min ?? 0), 0);
  const window = durationMin ? `~${durationMin} min` : "…";
  const mode = legs?.[0]?.mode ?? "transit";
  return {
    kind: "transit",
    name: toName,
    reason: t("play.plan.transit_directions"),
    window,
    transportLabel: mode,
  };
}
