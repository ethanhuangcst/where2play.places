import { describe, expect, it } from "vitest";
import { coverUrlFromSnapshot, summaryFromSnapshot } from "@/src/core/saved-itinerary";
import type { ItineraryDto } from "@/src/core/itinerary-types";

const ITINERARY: ItineraryDto = {
  title: "Test",
  destination: "X",
  daysCount: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "D1", title: "T", tags: [] },
      slots: [
        {
          kind: "place",
          start: "09:00",
          end: "10:00",
          placeKind: "Attraction",
          name: "First Place",
          summary: "s",
          photoUrl: "https://example.com/a.jpg",
        },
        {
          kind: "place",
          start: "11:00",
          end: "12:00",
          placeKind: "Food",
          name: "Second Place",
          summary: "s",
        },
      ],
    },
  ],
};

describe("saved-itinerary", () => {
  it("should_pick_first_place_photo_as_cover", () => {
    expect(coverUrlFromSnapshot(ITINERARY)).toBe("https://example.com/a.jpg");
  });

  it("should_build_summary_from_place_names", () => {
    expect(summaryFromSnapshot(ITINERARY)).toBe("First Place · Second Place");
  });
});
