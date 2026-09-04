import { describe, expect, it } from "vitest";
import { skeletonStopsForFocusedDay } from "../src/core/plan-skeleton-stops";
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
});
