import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractPlanLedgerFromEvent,
  itineraryFromSkeletonFetch,
  mergePlanCriteria,
  refreshItineraryFromTripLedger,
  shouldPersistPlanCacheEvent,
} from "../src/core/plan-session-cache";
import * as client from "../src/places-agent/client";

describe("plan-session-cache (TC-M19-81-02)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should_merge_trip_id_and_revision_into_criteria", () => {
    const merged = mergePlanCriteria(
      { destination: "Lisbon", days: 2, startDate: "2026-10-10" },
      { tripId: "trip-1", revision: 4 },
    );
    expect(merged.tripId).toBe("trip-1");
    expect(merged.revision).toBe(4);
    expect(merged.destination).toBe("Lisbon");
  });

  it("should_persist_skeleton_pipeline_events", () => {
    expect(shouldPersistPlanCacheEvent({ type: "skeleton_day" })).toBe(true);
    expect(shouldPersistPlanCacheEvent({ type: "stop_filled" })).toBe(true);
    expect(shouldPersistPlanCacheEvent({ type: "phase" })).toBe(false);
    expect(shouldPersistPlanCacheEvent({ type: "ledger" })).toBe(false);
  });

  it("should_extract_ledger_from_skeleton_done_and_ledger_events", () => {
    expect(
      extractPlanLedgerFromEvent({ type: "ledger", tripId: "t1", revision: 2 }),
    ).toEqual({ tripId: "t1", revision: 2 });
    expect(
      extractPlanLedgerFromEvent({ type: "skeleton_done", tripId: "t2", revision: 3 }),
    ).toEqual({ tripId: "t2", revision: 3 });
  });

  it("should_build_itinerary_days_from_fetched_skeleton", () => {
    const itinerary = itineraryFromSkeletonFetch(
      { destination: "Lisbon", days: 2, startDate: "2026-10-10" },
      {
        days: [
          { day_index: 1, day_theme: "Belém", stops: [{ name: "Tower", kind: "attraction" }] },
          { day_index: 2, stops: [{ name: "Castle", kind: "attraction" }] },
        ],
      },
      null,
      "EN",
    );
    expect(itinerary.days).toHaveLength(2);
    expect(itinerary.days[0]?.dayIndex).toBe(1);
    expect(itinerary.days[0]?.highlights.title).toBe("Belém");
  });

  it("should_refresh_itinerary_from_trip_ledger_via_fetch", async () => {
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "trip-1",
        revision: 5,
        data: {
          skeleton: {
            days: [{ day_index: 1, stops: [{ name: "Tower", kind: "attraction" }] }],
          },
        },
      },
    });

    const refreshed = await refreshItineraryFromTripLedger({
      criteria: {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        tripId: "trip-1",
        revision: 4,
      },
      cached: null,
      locale: "EN",
    });

    expect(refreshed?.criteria.tripId).toBe("trip-1");
    expect(refreshed?.criteria.revision).toBe(5);
    expect(refreshed?.itinerary.days).toHaveLength(1);
  });
});
