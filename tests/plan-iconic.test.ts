import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchIconicPlacesForPlan,
  iconicPlacesFromTravelTips,
  rankIconicFromPool,
} from "../src/core/plan-iconic";
import * as client from "../src/places-agent/client";

describe("rankIconicFromPool", () => {
  it("should_rank_iconic_from_pool_by_review_count", () => {
    expect(
      rankIconicFromPool(
        [
          { name: "Quiet", user_ratings_total: 10, rating: 5 },
          { name: "Hot", user_ratings_total: 9000, rating: 4.4 },
          { name: "Hot", user_ratings_total: 1, rating: 5 },
        ],
        5,
      ),
    ).toEqual(["Hot", "Quiet"]);
  });
});

describe("iconicPlacesFromTravelTips", () => {
  it("should_return_ordered_unique_iconic_places_only", () => {
    expect(
      iconicPlacesFromTravelTips({
        iconic_places: ["Tower", "  Tower  ", "Palace", 1, ""],
        inferred_must_see: ["ShouldNotAppear"],
      }),
    ).toEqual(["Tower", "Palace"]);
  });

  it("should_return_empty_when_iconic_places_missing", () => {
    expect(iconicPlacesFromTravelTips({ inferred_must_see: ["X"] })).toEqual([]);
  });
});

describe("fetchIconicPlacesForPlan", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should_return_iconic_places_from_fetch_artifacts_not_write_body", async () => {
    const spy = vi.spyOn(client, "travelTips").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        iconic_places: ["IGNORE_HTTP"],
        intro: "x",
        trip_id: "trip-1",
        revision: 2,
      },
    });
    const fetchSpy = vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "trip-1",
        revision: 2,
        data: { artifacts: { tips: { iconic_places: ["Belém Tower", "Sintra"] } } },
      },
    });
    const discoverSpy = vi.spyOn(client, "discoverPlaces");

    const names = await fetchIconicPlacesForPlan({
      destination: "Lisbon",
      startDate: "2026-10-10",
      days: 4,
      locale: "EN",
    });

    expect(names).toEqual(["Belém Tower", "Sintra"]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(discoverSpy).not.toHaveBeenCalled();
    const body = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.destination).toBe("Lisbon");
    expect(body.bounds).toEqual({ start: "2026-10-10", end: "2026-10-13" });
    expect(fetchSpy.mock.calls[0]?.[0]).toMatchObject({
      trip_id: "trip-1",
      fields: ["artifacts"],
    });
  });

  it("should_return_empty_when_travel_tips_fails", async () => {
    vi.spyOn(client, "travelTips").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "errors.travel_tips_failed" },
    });
    await expect(
      fetchIconicPlacesForPlan({
        destination: "Lisbon",
        startDate: "2026-10-10",
        days: 4,
        locale: "EN",
      }),
    ).resolves.toEqual([]);
  });
});
