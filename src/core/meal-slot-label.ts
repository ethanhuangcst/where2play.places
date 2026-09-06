/**
 * Meal slot i18n helpers.
 * Skeleton may store slot ids (`lunch`/`dinner`) until plan_next_stop resolves a restaurant;
 * once `name` is a real venue, show that name (24-P0-ui-A follow-up).
 */

export function mealSlotLabelKey(
  slot?: string | null,
): "play.plan.meal_slot_lunch" | "play.plan.meal_slot_dinner" | "play.plan.meal_slot_afternoon_tea" | undefined {
  if (slot === "lunch") return "play.plan.meal_slot_lunch";
  if (slot === "dinner") return "play.plan.meal_slot_dinner";
  if (slot === "afternoon_tea") return "play.plan.meal_slot_afternoon_tea";
  return undefined;
}

/** True when `name` is only a meal slot id, not a restaurant. */
export function isMealSlotIdName(name?: string | null): boolean {
  return mealSlotLabelKey(name) != null;
}

/** Recommend field for preview_meal — never echo lunch/dinner label as the venue. */
export function mealPreviewRecommendName(
  name: string | undefined,
  mealLabel: string,
): string {
  const n = name?.trim() ?? "";
  if (!n || isMealSlotIdName(n) || n === mealLabel) return "…";
  return n;
}

export function skeletonStopLabel(
  stop: { name?: string; kind?: string; mealSlot?: string; meal_slot?: string },
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const slot = stop.mealSlot ?? stop.meal_slot;
  const key = mealSlotLabelKey(slot);
  const name = stop.name?.trim() ?? "";

  if (key || stop.kind === "meal") {
    if (name && !isMealSlotIdName(name)) return name;
    if (key) return t(key);
    const fromName = mealSlotLabelKey(stop.name);
    if (fromName) return t(fromName);
  }

  if (stop.kind === "stay" || stop.kind === "stay_origin") {
    return t("play.plan.origin_stop", { name: stop.name ?? "" });
  }
  return stop.name ?? "";
}
