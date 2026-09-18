import { describe, expect, it } from "vitest";
import { mergeRefineSkeletonIntoItinerary } from "../src/core/plan-chat-refine";
import type { ItineraryDto } from "../src/core/itinerary-types";

const t = (key: string) => key;

describe("mergeRefineSkeletonIntoItinerary", () => {
  it("should_drop_removed_stops_and_keep_matching_slots", () => {
    const current: ItineraryDto = {
      title: "杭州",
      destination: "杭州",
      daysCount: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      days: [
        {
          dayIndex: 1,
          highlights: { label: "D1", title: "西湖", tags: [] },
          slots: [
            {
              kind: "place",
              start: "10:00",
              end: "11:00",
              placeKind: "Attraction",
              name: "苏堤",
              summary: "",
            },
            {
              kind: "place",
              start: "13:00",
              end: "14:00",
              placeKind: "Attraction",
              name: "雷峰塔",
              summary: "",
            },
          ],
        },
      ],
    };

    const next = mergeRefineSkeletonIntoItinerary(
      current,
      {
        days: [{ day_index: 1, day_theme: "西湖", stops: [{ name: "苏堤", kind: "attraction" }] }],
      },
      t,
    );

    expect(next.days[0]?.slots).toHaveLength(1);
    expect(next.days[0]?.slots[0]?.kind === "place" && next.days[0].slots[0].name).toBe("苏堤");
  });
});
