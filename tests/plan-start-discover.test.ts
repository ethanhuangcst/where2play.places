import { afterEach, describe, expect, it, vi } from "vitest";
import { startPlanDiscover } from "../src/core/plan-start-discover";
import * as client from "../src/places-agent/client";

describe("startPlanDiscover", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should_return_must_see_names_from_fetch_candidates_not_discover_envelope", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 1,
        candidates: { places: [{ name: "IGNORE_HTTP", must_see: true }] },
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: {
          candidates: {
            places: [
              { name: "Belém Tower", must_see: true },
              { name: "Mall", must_see: false },
            ],
          },
        },
      },
    });

    const result = await startPlanDiscover({
      destination: "Lisbon",
      startDate: "2026-10-10",
      days: 4,
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    });

    expect(client.discoverPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ max_number: 5 }),
    );
    expect(result).toEqual({
      ok: true,
      trip_id: "t1",
      revision: 2,
      iconic_places: ["Belém Tower"],
      pool: [
        { name: "Belém Tower", heat: null, must_see: true, kind: "place" },
        { name: "Mall", heat: null, must_see: false, kind: "place" },
      ],
    });
  });

  it("should_fail_when_fetch_pool_is_empty", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 1 },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 1, data: { candidates: { places: [], restaurants: [] } } },
    });
    await expect(
      startPlanDiscover({
        destination: "Lisbon",
        startDate: "2026-10-10",
        days: 4,
        locale: "EN",
      }),
    ).resolves.toEqual({
      ok: true,
      trip_id: "t1",
      revision: 1,
      iconic_places: [],
      pool: [],
    });
  });
});
