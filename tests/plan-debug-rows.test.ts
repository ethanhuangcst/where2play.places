import { describe, expect, it } from "vitest";
import { debugOriginRows } from "../src/core/plan-debug-rows";
import type { ItineraryDto, PlanBoundaries } from "../src/core/itinerary-types";

describe("debugOriginRows", () => {
  it("should_use_originStay_provider_when_present", () => {
    const criteria: PlanBoundaries = {
      destination: "Lisbon",
      days: 2,
      startDate: "2026-09-01",
      originStay: { name: "Hotel A", lat: 1, lng: 2, provider: "AMAP" },
    };
    expect(debugOriginRows(criteria, null)).toEqual([
      { name: "Hotel A", kind: "origin", provider: "AMAP" },
    ]);
  });

  it("should_fall_back_to_dailyStart_then_itinerary_stay_slots", () => {
    const criteria: PlanBoundaries = {
      destination: "Lisbon",
      days: 1,
      startDate: "2026-09-01",
      dailyStart: "City center",
    };
    const itinerary: ItineraryDto = {
      title: "t",
      destination: "Lisbon",
      daysCount: 1,
      updatedAt: "2026-09-01T00:00:00Z",
      days: [
        {
          dayIndex: 1,
          highlights: { label: "D1", title: "d", tags: [] },
          slots: [
            {
              kind: "place",
              start: "09:00",
              end: "09:30",
              placeKind: "stay",
              name: "Hotel A",
              summary: "",
              provider: "GOOGLE_MAPS",
            },
          ],
        },
      ],
    };
    const rows = debugOriginRows(criteria, itinerary);
    expect(rows.map((r) => r.name)).toEqual(["City center", "Hotel A"]);
    expect(rows[1]?.provider).toBe("GOOGLE_MAPS");
  });
});
