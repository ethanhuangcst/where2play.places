import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTripCandidates } from "../src/core/plan-fetch-candidates";
import * as client from "../src/places-agent/client";

describe("fetchTripCandidates (F41 S2 fetch_trip_details)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should_map_must_see_and_heat_from_fetch_candidates", async () => {
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 3,
        data: {
          candidates: {
            places: [
              { name: "Hot Alpha", must_see: true, user_ratings_total: 9_000 },
              { name: "Quiet Spot", must_see: false, user_ratings_total: 10 },
            ],
          },
        },
      },
    });

    const out = await fetchTripCandidates({
      trip_id: "t1",
      locale: "EN",
      days: 4,
      max_number: 5,
    });

    expect(client.fetchTripDetails).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "t1", fields: ["candidates"], locale: "EN" }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.iconic_places).toEqual(["Hot Alpha"]);
    expect(out.pool).toEqual([
      { name: "Hot Alpha", heat: 9_000, must_see: true, kind: "place" },
      { name: "Quiet Spot", heat: 10, must_see: false, kind: "place" },
    ]);
  });
});
