import { describe, expect, it } from "vitest";
import { mealSlotLabelKey, skeletonStopLabel } from "../src/core/meal-slot-label";

describe("mealSlotLabelKey (TC-M22-85-04)", () => {
  it("should_map_slots_to_i18n_keys_not_locale_copy", () => {
    expect(mealSlotLabelKey("lunch")).toBe("play.plan.meal_slot_lunch");
    expect(mealSlotLabelKey("dinner")).toBe("play.plan.meal_slot_dinner");
    expect(mealSlotLabelKey("afternoon_tea")).toBe("play.plan.meal_slot_afternoon_tea");
    expect(mealSlotLabelKey("bistro")).toBeUndefined();
  });

  it("should_resolve_skeleton_meal_via_key", () => {
    const t = (key: string) => key;
    expect(
      skeletonStopLabel({ kind: "meal", meal_slot: "lunch", name: "楼外楼" }, t),
    ).toBe("play.plan.meal_slot_lunch");
    expect(skeletonStopLabel({ kind: "attraction", name: "贝伦塔" }, t)).toBe("贝伦塔");
  });

  it("should_label_stay_as_origin_stop (TC-M23-92)", () => {
    const t = (key: string, vars?: Record<string, string>) =>
      key === "play.plan.origin_stop" ? `Origin · ${vars?.name ?? ""}` : key;
    expect(skeletonStopLabel({ kind: "stay", name: "Hills Hotel" }, t)).toBe(
      "Origin · Hills Hotel",
    );
    expect(skeletonStopLabel({ kind: "stay_origin", name: "Lisbon" }, t)).toBe("Origin · Lisbon");
  });
});
