import { describe, expect, it } from "vitest";
import { mealSlotLabelKey, skeletonStopLabel } from "../src/core/meal-slot-label";

describe("mealSlotLabelKey (TC-M22-85-04)", () => {
  it("should_map_slots_to_i18n_keys_not_locale_copy", () => {
    expect(mealSlotLabelKey("lunch")).toBe("play.plan.meal_slot_lunch");
    expect(mealSlotLabelKey("dinner")).toBe("play.plan.meal_slot_dinner");
    expect(mealSlotLabelKey("afternoon_tea")).toBe("play.plan.meal_slot_afternoon_tea");
    expect(mealSlotLabelKey("bistro")).toBeUndefined();
  });

  it("should_prefer_restaurant_name_over_meal_slot_label", () => {
    const t = (key: string) => key;
    expect(
      skeletonStopLabel({ kind: "meal", meal_slot: "lunch", name: "楼外楼" }, t),
    ).toBe("楼外楼");
    expect(
      skeletonStopLabel({ kind: "meal", mealSlot: "dinner", name: "Comidas de Santiago" }, t),
    ).toBe("Comidas de Santiago");
  });

  it("should_fall_back_to_meal_slot_when_name_is_slot_id", () => {
    const t = (key: string) => key;
    expect(skeletonStopLabel({ kind: "meal", meal_slot: "lunch", name: "lunch" }, t)).toBe(
      "play.plan.meal_slot_lunch",
    );
    expect(skeletonStopLabel({ kind: "meal", mealSlot: "dinner", name: "dinner" }, t)).toBe(
      "play.plan.meal_slot_dinner",
    );
  });

  it("should_resolve_attraction_and_origin_labels", () => {
    const t = (key: string, vars?: Record<string, string>) =>
      key === "play.plan.origin_stop" ? `Origin · ${vars?.name ?? ""}` : key;
    expect(skeletonStopLabel({ kind: "attraction", name: "贝伦塔" }, t)).toBe("贝伦塔");
    expect(skeletonStopLabel({ kind: "stay", name: "Hills Hotel" }, t)).toBe(
      "Origin · Hills Hotel",
    );
    expect(skeletonStopLabel({ kind: "stay_origin", name: "Lisbon" }, t)).toBe("Origin · Lisbon");
  });
});
