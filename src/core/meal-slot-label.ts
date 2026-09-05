/** i18n key for a skeleton meal slot (F85). Never a restaurant shop name. */
export function mealSlotLabelKey(
  slot?: string | null,
): "play.plan.meal_slot_lunch" | "play.plan.meal_slot_dinner" | "play.plan.meal_slot_afternoon_tea" | undefined {
  if (slot === "lunch") return "play.plan.meal_slot_lunch";
  if (slot === "dinner") return "play.plan.meal_slot_dinner";
  if (slot === "afternoon_tea") return "play.plan.meal_slot_afternoon_tea";
  return undefined;
}

export function skeletonStopLabel(
  stop: { name?: string; kind?: string; mealSlot?: string; meal_slot?: string },
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const slot = stop.mealSlot ?? stop.meal_slot;
  const key = mealSlotLabelKey(slot);
  if (key) return t(key);
  if (stop.kind === "meal") {
    const fromName = mealSlotLabelKey(stop.name);
    if (fromName) return t(fromName);
  }
  if (stop.kind === "stay" || stop.kind === "stay_origin") {
    return t("play.plan.origin_stop", { name: stop.name ?? "" });
  }
  return stop.name ?? "";
}
