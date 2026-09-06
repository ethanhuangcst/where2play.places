import type { SlotPreviewPayload } from "./itinerary-map";
import { isMealSlotIdName, mealPreviewRecommendName, skeletonStopLabel } from "./meal-slot-label";

type PreviewT = (key: string, vars?: Record<string, string>) => string;

export function formatSlotPreviewLine(preview: SlotPreviewPayload, t: PreviewT): string {
  if (preview.kind === "transit") {
    return t("play.plan.preview_transit", {
      label: preview.transportLabel ?? preview.name,
      duration: preview.window,
    });
  }
  if (preview.kind === "meal") {
    const mealKey =
      preview.mealLabel === "dinner"
        ? "play.plan.meal_slot_dinner"
        : preview.mealLabel === "afternoon_tea"
          ? "play.plan.meal_slot_afternoon_tea"
          : "play.plan.meal_slot_lunch";
    const meal = t(mealKey);
    return t("play.plan.preview_meal", {
      meal,
      name: mealPreviewRecommendName(preview.name, meal),
      window: preview.window,
    });
  }
  return t("play.plan.preview_place", {
    name: preview.name,
    window: preview.window,
  });
}

export function previewForSkeletonStop(
  stop: { name: string; kind?: string; meal_slot?: string },
  t: PreviewT,
): SlotPreviewPayload {
  const reason = t("play.plan.preview_reason_skeleton");
  if (stop.meal_slot || stop.kind === "meal" || isMealSlotIdName(stop.name)) {
    const slot =
      stop.meal_slot === "lunch" ||
      stop.meal_slot === "dinner" ||
      stop.meal_slot === "afternoon_tea"
        ? stop.meal_slot
        : isMealSlotIdName(stop.name)
          ? (stop.name as "lunch" | "dinner" | "afternoon_tea")
          : "lunch";
    const venue =
      stop.name && !isMealSlotIdName(stop.name) ? stop.name : "…";
    return {
      kind: "meal",
      name: venue,
      reason,
      window: "…",
      mealLabel: slot,
    };
  }
  return {
    kind: "place",
    name: stop.kind === "stay" ? skeletonStopLabel(stop, t) : stop.name,
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

/** Stop kind label for lists / later fill timeline (24-P0-ui-A). */
export function planStopKindLabel(
  kind: string | undefined,
  t: PreviewT,
  mealSlot?: string | null,
): string {
  const raw = (kind ?? "").trim();
  const lower = raw.toLowerCase();
  if (mealSlot === "lunch" || lower === "lunch") return t("play.plan.meal_slot_lunch");
  if (mealSlot === "dinner" || lower === "dinner") return t("play.plan.meal_slot_dinner");
  if (mealSlot === "afternoon_tea" || lower === "afternoon_tea") {
    return t("play.plan.meal_slot_afternoon_tea");
  }
  if (lower === "meal" || lower === "food" || lower === "restaurant") {
    return t("play.plan.meal_slot_lunch");
  }
  if (lower === "stay" || lower === "stay_origin" || lower === "hotel") {
    return t("play.plan.kind_stay");
  }
  if (
    lower === "attraction" ||
    lower === "place" ||
    lower === "" ||
    raw === "ATTRACTION" ||
    raw === "STAY" ||
    raw === "MEAL"
  ) {
    if (raw === "STAY") return t("play.plan.kind_stay");
    if (raw === "MEAL") return t("play.plan.meal_slot_lunch");
    return t("play.plan.kind_attraction");
  }
  // Keep human/vendor categories; never leave English enum caps untranslated above.
  return raw;
}
