import type { SlotPreviewPayload } from "./itinerary-map";
import { skeletonStopLabel } from "./meal-slot-label";

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
      name: skeletonStopLabel(stop, t),
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
  legs: Array<{ mode?: string; duration_min?: number; recommended?: boolean }> | undefined,
  t: PreviewT,
): SlotPreviewPayload {
  if (!legs?.length) {
    return {
      kind: "transit",
      name: toName,
      reason: t("play.plan.transit_directions"),
      window: "…",
      transportLabel: "transit",
    };
  }
  const lines = legs.map((leg) => {
    const mode = leg.mode ?? "transit";
    const modeLabel = t(`play.plan.transit.mode.${mode}`);
    const minutes = leg.duration_min != null ? String(leg.duration_min) : "?";
    return t("play.plan.transit.line", { mode: modeLabel, minutes });
  });
  const or = t("play.plan.transit.or");
  const joined =
    lines.length === 1
      ? lines[0]!
      : lines.join(t("play.plan.transit.options_join", { or }));
  const primary = legs.find((l) => l.recommended) ?? legs[0]!;
  return {
    kind: "transit",
    name: toName,
    reason: t("play.plan.transit_directions"),
    window: primary.duration_min != null ? `~${primary.duration_min} min` : "…",
    transportLabel: joined,
  };
}
