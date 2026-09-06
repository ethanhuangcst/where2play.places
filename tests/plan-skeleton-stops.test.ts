import { describe, expect, it } from "vitest";
import { patchSkeletonStopName, skeletonStopsForFocusedDay } from "../src/core/plan-skeleton-stops";
import type { ItinerarySlot } from "../src/core/itinerary-types";

describe("plan-skeleton-stops (TC-M19-40-04)", () => {
  const skeletonDays = [
    {
      dayIndex: 1,
      theme: "Belém",
      stops: [
        { name: "Hotel Lisboa", kind: "stay" },
        { name: "Belém Tower", kind: "attraction" },
      ],
    },
  ];

  const staySlot: ItinerarySlot = {
    kind: "place",
    start: "09:00",
    end: "09:30",
    placeKind: "stay",
    name: "Hotel Lisboa",
    summary: "",
  };

  it("should_keep_non_stay_skeleton_row_pending_while_stay_is_filled", () => {
    const rows = skeletonStopsForFocusedDay(skeletonDays, 1, [staySlot], "filling");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.filled).toBe(true);
    expect(rows[1]?.name).toBe("Belém Tower");
    expect(rows[1]?.pending).toBe(true);
    expect(rows[1]?.filled).toBe(false);
  });

  it("should_patch_meal_stop_name_to_restaurant_after_fill", () => {
    const days = [
      {
        dayIndex: 1,
        stops: [
          { name: "Hotel", kind: "stay" },
          { name: "lunch", kind: "meal", mealSlot: "lunch" },
        ],
      },
    ];
    const next = patchSkeletonStopName(days, 1, 1, "Comidas de Santiago");
    expect(next[0]?.stops[1]?.name).toBe("Comidas de Santiago");
    expect(next[0]?.stops[1]?.mealSlot).toBe("lunch");
    expect(next[0]?.stops[1]?.filled).toBe(true);
  });

  it("should_return_empty_when_idle_after_fill (TC-M24-UIC-01)", () => {
    const rows = skeletonStopsForFocusedDay(skeletonDays, 1, [staySlot], "idle");
    expect(rows).toEqual([]);
  });

  it("should_return_empty_when_filling_but_day_committed (24-P0-ui-C-fix)", () => {
    const rows = skeletonStopsForFocusedDay(skeletonDays, 1, [], "filling", {
      committedPlaceCount: 2,
    });
    expect(rows).toEqual([]);
  });
});
