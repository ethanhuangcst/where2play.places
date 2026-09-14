import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTripCandidates } from "../src/core/plan-fetch-candidates";
import * as client from "../src/places-agent/client";

describe("fetchTripCandidates (F41 S2 fetch_trip_details)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should_map_iconic_from_artifacts_and_pool_heat_without_must_see", async () => {
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 3,
        data: {
          candidates: {
            places: [
              { name: "Hot Alpha", user_ratings_total: 9_000 },
              { name: "Quiet Spot", user_ratings_total: 10 },
            ],
          },
          artifacts: {
            tips: { iconic_places: ["Hot Alpha"] },
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
      expect.objectContaining({
        trip_id: "t1",
        fields: ["candidates", "artifacts"],
        locale: "EN",
      }),
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.iconic_places).toEqual(["Hot Alpha"]);
    expect(out.pool).toEqual([
      { name: "Hot Alpha", heat: 9_000, kind: "place" },
      { name: "Quiet Spot", heat: 10, kind: "place" },
    ]);
  });
});
