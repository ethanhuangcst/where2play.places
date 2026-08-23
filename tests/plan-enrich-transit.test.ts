import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichArrangedDay,
  setEnrichArrangeTransitForTests,
  setGeocodeForTests,
  resetGeocodeCache,
} from "../src/core/plan-enrich-transit";
import type { ArrangeDayLlmResult, ScheduleCandidatePools } from "../src/core/plan-arrange-llm";
import type { PlanBoundaries } from "../src/core/itinerary-types";

const baseCriteria: PlanBoundaries = {
  destination: "里斯本",
  days: 4,
  startDate: "2026-09-20",
  pace: "tight",
  budget: "medium",
  dailyStart: "Hills Hotel Lisboa",
  dailyEnd: "Hills Hotel Lisboa",
  partySize: 2,
};

const baseArranged: ArrangeDayLlmResult = {
  day_index: 1,
  date: "2026-09-20",
  theme: "老城 city walk",
  blocks: [
    { name: "Miradouro da Senhora do Monte", type: "attraction", start_time: "09:30", duration_min: 45, reason: "viewpoint" },
  ],
};

const baseCandidates: ScheduleCandidatePools = { places: [], restaurants: [] };

function makeGeocodeFn(coords: { lat: number; lng: number } | null) {
  return vi.fn(async () =>
    coords
      ? { agent: "places-agent", ok: true, data: { lat: coords.lat, lng: coords.lng, crs: "WGS84", label: "Hills Hotel Lisboa" } }
      : { agent: "places-agent", ok: false, outcome: { key: "errors.provider_failed" } },
  );
}

function makeEnrichFn(result: Partial<ArrangeDayLlmResult>) {
  return vi.fn(async (): Promise<ArrangeDayLlmResult> => ({
    day_index: baseArranged.day_index,
    date: baseArranged.date,
    theme: baseArranged.theme,
    blocks: baseArranged.blocks,
    from_origin: { transport: "walk", duration_min: 27 },
    to_destination: { transport: "taxi", duration_min: 15 },
    transit_outcome: "directions",
    ...result,
  }));
}

beforeEach(() => {
  resetGeocodeCache();
});

afterEach(() => {
  setEnrichArrangeTransitForTests(null);
  setGeocodeForTests(null);
});

describe("enrichArrangedDay — geocode origin/destination before enrich", () => {
  it("should_geocode_origin_name_then_pass_coordinates_to_enrich", async () => {
    const geocodeFn = makeGeocodeFn({ lat: 38.7304, lng: -9.1405 });
    setGeocodeForTests(geocodeFn as unknown as typeof import("../src/places-agent/client").geocode);

    let capturedBody: Record<string, unknown> | undefined;
    const enrichFn = vi.fn(async (body: Record<string, unknown>): Promise<ArrangeDayLlmResult> => {
      capturedBody = body;
      return { ...baseArranged, from_origin: { transport: "walk", duration_min: 27 }, transit_outcome: "directions" };
    });
    setEnrichArrangeTransitForTests(enrichFn);

    await enrichArrangedDay({
      arranged: baseArranged,
      criteria: baseCriteria,
      providers: ["GOOGLE_MAPS"],
      locale: "CN",
      candidates: baseCandidates,
    });

    expect(geocodeFn).toHaveBeenCalledTimes(1);
    expect(geocodeFn).toHaveBeenCalledWith(expect.objectContaining({ query: "Hills Hotel Lisboa" }));
    expect(capturedBody).toBeDefined();
    const origin = (capturedBody as Record<string, unknown>).origin as Record<string, unknown>;
    expect(origin.lat).toBe(38.7304);
    expect(origin.lng).toBe(-9.1405);
    expect(origin.name).toBe("Hills Hotel Lisboa");
  });

  it("should_cache_geocode_so_same_origin_not_recalled", async () => {
    const geocodeFn = makeGeocodeFn({ lat: 38.7304, lng: -9.1405 });
    setGeocodeForTests(geocodeFn as unknown as typeof import("../src/places-agent/client").geocode);
    setEnrichArrangeTransitForTests(makeEnrichFn({}));

    for (let i = 0; i < 2; i++) {
      await enrichArrangedDay({
        arranged: { ...baseArranged, day_index: i + 1 },
        criteria: baseCriteria,
        providers: ["GOOGLE_MAPS"],
        locale: "CN",
        candidates: baseCandidates,
      });
    }

    expect(geocodeFn).toHaveBeenCalledTimes(1);
  });

  it("should_show_i18n_key_and_not_fake_transit_when_geocode_fails", async () => {
    const geocodeFn = makeGeocodeFn(null);
    setGeocodeForTests(geocodeFn as unknown as typeof import("../src/places-agent/client").geocode);

    let capturedBody: Record<string, unknown> | undefined;
    const enrichFn = vi.fn(async (body: Record<string, unknown>): Promise<ArrangeDayLlmResult> => {
      capturedBody = body;
      return { ...baseArranged, transit_outcome: "directions" };
    });
    setEnrichArrangeTransitForTests(enrichFn);

    const result = await enrichArrangedDay({
      arranged: baseArranged,
      criteria: baseCriteria,
      providers: ["GOOGLE_MAPS"],
      locale: "CN",
      candidates: baseCandidates,
    });

    expect(geocodeFn).toHaveBeenCalled();
    expect(capturedBody).toBeDefined();
    const origin = (capturedBody as Record<string, unknown>).origin as Record<string, unknown>;
    expect(origin.lat).toBeUndefined();
    expect(origin.name).toBe("Hills Hotel Lisboa");
    expect(result.from_origin).toBeUndefined();
    expect(result.transit_outcome).toBe("partial");
  });

  it("should_geocode_destination_name_and_get_to_destination", async () => {
    const geocodeFn = makeGeocodeFn({ lat: 38.7304, lng: -9.1405 });
    setGeocodeForTests(geocodeFn as unknown as typeof import("../src/places-agent/client").geocode);
    setEnrichArrangeTransitForTests(makeEnrichFn({}));

    const result = await enrichArrangedDay({
      arranged: baseArranged,
      criteria: { ...baseCriteria, dailyEnd: "Hills Hotel Lisboa" },
      providers: ["GOOGLE_MAPS"],
      locale: "CN",
      candidates: baseCandidates,
    });

    expect(result.to_destination).toEqual({ transport: "taxi", duration_min: 15 });
  });
});
