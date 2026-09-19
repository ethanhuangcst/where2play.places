/**
 * Trip ledger refresh must not paint stale filled days after skeleton refine.
 */
import { describe, expect, it } from "vitest";
import {
  cachedDayMatchesSkeletonAttractions,
  itineraryFromSkeletonFetch,
} from "@/src/core/plan-session-cache";
import type { ItineraryDto } from "@/src/core/itinerary-types";

const criteria = {
  destination: "上海",
  days: 3,
  startDate: "2026-10-01",
  partySize: 2,
  budget: "mid",
  locale: "CN",
};

const skeletonDay2 = {
  day_index: 2,
  day_theme: "亲子",
  stops: [
    { name: "酒店", kind: "stay" },
    { name: "上海科技馆", kind: "attraction" },
    { name: "lunch", kind: "meal", meal_slot: "lunch" },
    { name: "上海自然博物馆", kind: "attraction" },
  ],
};

const cachedDay2Haichang: ItineraryDto["days"][number] = {
  dayIndex: 2,
  highlights: { label: "D2", title: "亲子", tags: [] },
  slots: [
    {
      kind: "place",
      start: "09:00",
      end: "11:30",
      placeKind: "Attraction",
      name: "上海海昌海洋公园",
      summary: "",
    },
    {
      kind: "place",
      start: "12:00",
      end: "13:00",
      placeKind: "Meal",
      name: "午餐",
      summary: "",
      mealSlot: "lunch",
    },
    {
      kind: "place",
      start: "13:30",
      end: "15:00",
      placeKind: "Attraction",
      name: "上海自然博物馆",
      summary: "",
    },
  ],
};

describe("plan-session-cache skeleton merge", () => {
  it("should_reject_cached_day_when_skeleton_attraction_names_diverged", () => {
    expect(cachedDayMatchesSkeletonAttractions(cachedDay2Haichang, skeletonDay2)).toBe(false);
  });

  it("should_not_reuse_stale_cached_slots_after_morning_refine", () => {
    const cached: ItineraryDto = {
      title: "上海",
      destination: "上海",
      daysCount: 3,
      updatedAt: new Date().toISOString(),
      days: [cachedDay2Haichang],
    };
    const merged = itineraryFromSkeletonFetch(
      criteria,
      { days: [skeletonDay2] },
      cached,
      "CN",
    );
    const day2 = merged.days.find((d) => d.dayIndex === 2);
    expect(day2?.slots.length).toBe(0);
    expect(day2?.slots.some((s) => s.name.includes("海昌"))).toBe(false);
  });

  it("should_reuse_cached_day_when_skeleton_names_match", () => {
    const matchingSkeleton = {
      ...skeletonDay2,
      stops: [
        { name: "酒店", kind: "stay" },
        { name: "上海海昌海洋公园", kind: "attraction" },
        { name: "lunch", kind: "meal", meal_slot: "lunch" },
        { name: "上海自然博物馆", kind: "attraction" },
      ],
    };
    expect(cachedDayMatchesSkeletonAttractions(cachedDay2Haichang, matchingSkeleton)).toBe(true);
  });
});
