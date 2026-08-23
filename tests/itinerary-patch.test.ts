import { describe, expect, it } from "vitest";
import type { ItineraryDto } from "../src/core/itinerary-types";
import { applyAssistantItineraryResult } from "../src/core/itinerary-patch";

const base: ItineraryDto = {
  title: "Taipei 2 days",
  destination: "Taipei",
  daysCount: 2,
  updatedAt: "2026-08-22T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "D1", title: "Museum", tags: [] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "NPM",
          summary: "museum",
        },
      ],
    },
    {
      dayIndex: 2,
      highlights: { label: "D2", title: "Night", tags: [] },
      slots: [
        {
          kind: "place",
          start: "19:00",
          end: "21:00",
          placeKind: "Food",
          name: "Night Market",
          summary: "street food",
        },
      ],
    },
  ],
};

describe("itinerary-patch (U-07c)", () => {
  it("should_prefer_itineraryPatch_over_full_itinerary", () => {
    const patched = applyAssistantItineraryResult(base, {
      itineraryPatch: {
        days: [
          {
            dayIndex: 1,
            slots: [
              {
                kind: "place",
                start: "10:00",
                end: "11:30",
                placeKind: "Attraction",
                name: "NPM",
                summary: "shorter visit",
              },
            ],
          },
        ],
      },
      itinerary: {
        ...base,
        title: "SHOULD_NOT_APPLY",
      },
    });
    expect(patched.title).toBe("Taipei 2 days");
    expect(patched.days[0]?.slots[0]?.kind === "place" && patched.days[0].slots[0].summary).toBe(
      "shorter visit",
    );
    expect(patched.days[1]?.slots[0]?.kind === "place" && patched.days[1].slots[0].name).toBe(
      "Night Market",
    );
  });

  it("should_replace_when_only_full_itinerary", () => {
    const next: ItineraryDto = { ...base, title: "Replaced" };
    const patched = applyAssistantItineraryResult(base, { itinerary: next });
    expect(patched.title).toBe("Replaced");
  });

  it("should_keep_current_when_neither_patch_nor_itinerary", () => {
    const patched = applyAssistantItineraryResult(base, {});
    expect(patched).toEqual(base);
  });
});
