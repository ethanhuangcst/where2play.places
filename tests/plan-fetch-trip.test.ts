import { describe, expect, it } from "vitest";
import { skeletonIsFillable } from "../src/core/plan-fetch-trip";

describe("skeletonIsFillable (TC-M22-SIGN-UI)", () => {
  it("should_reject_stay_only_and_stay_plus_meal_without_attraction", () => {
    expect(
      skeletonIsFillable({
        days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
      }),
    ).toBe(false);
    expect(
      skeletonIsFillable({
        days: [
          {
            day_index: 1,
            stops: [
              { name: "Hotel", kind: "stay" },
              { name: "lunch", kind: "meal", meal_slot: "lunch" },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it("should_accept_day_with_legacy_place_kind", () => {
    expect(
      skeletonIsFillable({
        days: [{ day_index: 1, stops: [{ name: "Tower", kind: "place" }] }],
      }),
    ).toBe(true);
  });

  it("should_accept_day_with_attraction_and_meal_slots", () => {
    expect(
      skeletonIsFillable({
        days: [
          {
            day_index: 1,
            stops: [
              { name: "Hotel", kind: "stay" },
              { name: "贝伦塔", kind: "attraction" },
              { name: "lunch", kind: "meal", meal_slot: "lunch" },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
