/**
 * Trip ledger refresh must not paint stale filled days after skeleton refine.
 */
import { describe, expect, it } from "vitest";
import {
  cachedDayMatchesSkeletonAttractions,
  itineraryFromSkeletonFetch,
  refreshItineraryFromTripLedger,
} from "@/src/core/plan-session-cache";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
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

  it("should_keep_full_cached_itinerary_on_refresh_when_board_has_filled_slots", async () => {
    setPlacesAgentFetchForTests(async (input) => {
      if (String(input).includes("/v1/fetch_trip_details")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-draft-1",
              revision: 9,
              data: {
                skeleton: {
                  days: [
                    {
                      day_index: 1,
                      stops: [
                        { name: "Hotel", kind: "stay" },
                        { name: "Different Attraction", kind: "attraction" },
                      ],
                    },
                  ],
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });

    const cached: ItineraryDto = {
      title: "上海",
      destination: "上海",
      daysCount: 1,
      updatedAt: new Date().toISOString(),
      days: [
        {
          dayIndex: 1,
          highlights: { label: "D1", title: "Day 1", tags: [] },
          slots: [
            {
              kind: "place",
              start: "09:00",
              end: "11:00",
              placeKind: "Attraction",
              name: "乐高探索中心",
              summary: "",
            },
          ],
        },
      ],
    };

    const refreshed = await refreshItineraryFromTripLedger({
      criteria: { ...criteria, days: 1, tripId: "trip-draft-1", revision: 8 },
      cached,
      locale: "CN",
    });
    setPlacesAgentFetchForTests(null);

    const slot0 = refreshed?.itinerary.days[0]?.slots[0];
    expect(slot0?.kind === "place" && slot0.name).toBe("乐高探索中心");
    expect(refreshed?.criteria.revision).toBe(9);
    expect(refreshed?.skeleton).toBeTruthy();
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

describe("refreshItineraryFromTripLedger artifacts hydrate (2play-plan-106)", () => {
  it("should_request_artifacts_and_return_travelTips_without_writing_visa_into_itinerary", async () => {
    let requestedFields: unknown;
    setPlacesAgentFetchForTests(async (input, init) => {
      if (String(input).includes("/v1/fetch_trip_details")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { fields?: string[] };
        requestedFields = body.fields;
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-106-1",
              revision: 4,
              data: {
                skeleton: {
                  days: [
                    {
                      day_index: 1,
                      stops: [
                        { name: "Hotel", kind: "stay" },
                        { name: "Marina Bay", kind: "attraction" },
                      ],
                    },
                  ],
                },
                artifacts: {
                  tips: {
                    intro: "Singapore tips",
                    iconic_places: ["Marina Bay Sands"],
                    transit: "MRT",
                    clothing: "Light",
                    safety: "Safe",
                    weather: { summary: "Hot" },
                  },
                  visa: {
                    passport: "CHN",
                    destination: "SGP",
                    requirement: "visa_free",
                    description: "30 days visa-free.",
                    max_stay: "30 days",
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });

    const cached: ItineraryDto = {
      title: "新加坡",
      destination: "新加坡",
      daysCount: 1,
      updatedAt: new Date().toISOString(),
      days: [
        {
          dayIndex: 1,
          highlights: { label: "D1", title: "Day 1", tags: [] },
          slots: [
            {
              kind: "place",
              start: "09:00",
              end: "11:00",
              placeKind: "Attraction",
              name: "Marina Bay",
              summary: "",
            },
          ],
        },
      ],
    };

    const refreshed = await refreshItineraryFromTripLedger({
      criteria: { ...criteria, destination: "新加坡", days: 1, tripId: "trip-106-1", revision: 3 },
      cached,
      locale: "CN",
    });
    setPlacesAgentFetchForTests(null);

    expect(requestedFields).toEqual(expect.arrayContaining(["skeleton", "filled", "artifacts"]));
    expect(refreshed?.travelTips?.intro).toBe("Singapore tips");
    expect(refreshed?.travelTips?.visa).toMatchObject({
      passport: "CHN",
      destination: "SGP",
      requirement: "visa_free",
    });
    expect(JSON.stringify(refreshed?.itinerary)).not.toContain("visa_free");
    expect((refreshed?.itinerary as { visa?: unknown }).visa).toBeUndefined();
  });

  it("should_omit_travelTips_when_artifacts_absent", async () => {
    setPlacesAgentFetchForTests(async (input) => {
      if (String(input).includes("/v1/fetch_trip_details")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-106-empty",
              revision: 2,
              data: {
                skeleton: {
                  days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });

    const refreshed = await refreshItineraryFromTripLedger({
      criteria: { ...criteria, days: 1, tripId: "trip-106-empty", revision: 1 },
      cached: null,
      locale: "CN",
    });
    setPlacesAgentFetchForTests(null);

    expect(refreshed?.travelTips).toBeUndefined();
  });
});
