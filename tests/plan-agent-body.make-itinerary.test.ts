import { describe, expect, it } from "vitest";
import {
  buildMakeItineraryBody,
  mapPace,
  mapSpend,
  originFromPlanCriteria,
  tripLedgerFields,
} from "../src/core/plan-agent-body";

describe("buildMakeItineraryBody agent enums", () => {
  it("should_map_localized_pace_and_budget_to_agent_enums", () => {
    const body = buildMakeItineraryBody(
      {
        destination: "Lisbon",
        days: 3,
        startDate: "2026-09-01",
        pace: "适中",
        budget: "$$ 经济型",
        mustInclude: ["Belém Tower"],
      },
      {
        locale: "CN",
        providers: ["GOOGLE_MAPS"],
        candidates: { places: [{ name: "Tower" }], restaurants: [] },
      },
    );
    expect(body.pace).toBe("medium");
    expect(body.budget).toBe("budget");
    expect(body.must_include).toEqual(["Belém Tower"]);
    expect(body.city).toBe("Lisbon");
  });

  it("should_map_english_pace_labels", () => {
    expect(mapPace("Balanced")).toBe("medium");
    expect(mapPace("Relaxed")).toBe("relaxed");
    expect(mapSpend("$$ Mid-range")).toBeUndefined();
    expect(mapSpend("Comfort")).toBe("premium");
  });

  it("should_omit_invalid_revision_from_trip_ledger_fields", () => {
    expect(tripLedgerFields("trip-1", undefined)).toEqual({ trip_id: "trip-1" });
    expect(tripLedgerFields("trip-1", null as unknown as number)).toEqual({ trip_id: "trip-1" });
    expect(tripLedgerFields("trip-1", 2)).toEqual({ trip_id: "trip-1", revision: 2 });
    expect(tripLedgerFields(undefined, 2)).toEqual({});
  });

  it("should_omit_revision_when_building_make_itinerary_body", () => {
    const body = buildMakeItineraryBody(
      { destination: "Lisbon", days: 3, startDate: "2026-09-01" },
      {
        locale: "EN",
        providers: ["GOOGLE_MAPS"],
        candidates: { places: [], restaurants: [] },
        tripId: "t1",
      },
    );
    expect(body.trip_id).toBe("t1");
    expect(body.revision).toBeUndefined();
  });

  it("should_send_origin_coords_only_when_session_resolved_them", () => {
    expect(
      originFromPlanCriteria({
        destination: "Lisbon",
        days: 2,
        startDate: "2026-10-10",
        dailyStart: "Hills Hotel Lisboa",
      }),
    ).toEqual({ name: "Hills Hotel Lisboa" });
    expect(
      originFromPlanCriteria({
        destination: "Lisbon",
        days: 2,
        startDate: "2026-10-10",
        dailyStart: "Hills Hotel Lisboa",
        originLat: 38.73,
        originLng: -9.14,
      }),
    ).toEqual({ name: "Hills Hotel Lisboa", lat: 38.73, lng: -9.14 });
  });
});
