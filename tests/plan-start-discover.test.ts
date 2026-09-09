import { afterEach, describe, expect, it, vi } from "vitest";
import { startPlanDiscover } from "../src/core/plan-start-discover";
import * as client from "../src/places-agent/client";

describe("startPlanDiscover", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should_call_plan_trip_not_discover_places_and_omit_providers", async () => {
    const tripSpy = vi.spyOn(client, "planTrip").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 1,
        status: "needs_input",
      },
    });
    vi.spyOn(client, "discoverPlaces");
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
    });

    expect(client.discoverPlaces).not.toHaveBeenCalled();
    expect(tripSpy).toHaveBeenCalledWith(
      expect.objectContaining({ city: "Lisbon", numDays: 4 }),
    );
    expect(tripSpy.mock.calls[0]?.[0]).not.toHaveProperty("providers");
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
    vi.spyOn(client, "planTrip").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 1, status: "needs_input" },
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
