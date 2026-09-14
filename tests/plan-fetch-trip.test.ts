import { describe, expect, it } from "vitest";
import { latestFilledStopFromSlice, skeletonIsFillable } from "../src/core/plan-fetch-trip";

describe("latestFilledStopFromSlice (MVP-T5 TD-6)", () => {
  it("should_read_latest_object_shape_from_http_plan_next_stop_write", () => {
    const latest = latestFilledStopFromSlice({
      filled: {
        stop: { name: "Torre de Belém", kind: "attraction" },
        slot: { start: "09:30", end: "11:00" },
        legs: [{ mode: "walk", duration_min: 12 }],
      },
    });
    expect(latest?.stop?.name).toBe("Torre de Belém");
    expect(latest?.slot?.end).toBe("11:00");
    expect(latest?.legs?.[0]?.duration_min).toBe(12);
  });

  it("should_read_last_entry_from_filled_stops_array", () => {
    const latest = latestFilledStopFromSlice({
      filled: {
        stops: [
          { stop: { name: "Hotel", kind: "stay" }, slot: { start: "09:00", end: "09:00" } },
          {
            stop: { name: "Tower", kind: "attraction" },
            slot: { start: "10:00", end: "11:00" },
            legs: [{ mode: "transit", duration_min: 20 }],
          },
        ],
      },
    });
    expect(latest?.stop?.name).toBe("Tower");
    expect(latest?.legs?.[0]?.duration_min).toBe(20);
  });
});

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
