import { describe, expect, it } from "vitest";
import {
  buildArrangeDayBody,
  buildPlanItineraryBody,
} from "../src/core/plan-agent-body";

describe("ADR-040 party_size mapping", () => {
  const criteria = {
    destination: "Lisbon",
    days: 2,
    startDate: "2026-09-01",
    partySize: 3,
  };

  it("should_map_partySize_to_party_size_on_arrange_body", () => {
    const body = buildArrangeDayBody(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
      dayIndex: 1,
      date: "2026-09-01",
      candidates: { places: [], restaurants: [] },
    });
    expect(body.party_size).toBe(3);
  });

  it("should_map_partySize_to_party_size_on_plan_itinerary_body", () => {
    const body = buildPlanItineraryBody(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    });
    expect(body.party_size).toBe(3);
  });
});
