import { describe, expect, it } from "vitest";
import {
  criteriaFromPlanTripBody,
  planTripBffBody,
  toAgentPlanTripBody,
} from "../src/core/plan-trip-body";

describe("planTripBffBody", () => {
  it("should_reject_when_city_missing", () => {
    const parsed = planTripBffBody.safeParse({
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "mid",
      tripType: "couple",
      pace: "medium",
      transit: "transit_walk",
    });
    expect(parsed.success).toBe(false);
  });

  it("should_omit_providers_when_mapping_to_agent", () => {
    const parsed = planTripBffBody.parse({
      city: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "mid",
      tripType: "couple",
      pace: "medium",
      transit: "transit_walk",
      locale: "EN",
    });
    const body = toAgentPlanTripBody(parsed);
    expect(body.providers).toBeUndefined();
    expect(body.city).toBe("Lisbon");
    expect(body.origin).toBeUndefined();
    expect(body.budget).toBe("mid");
    expect(body.transit_preference).toBe("transit_walk");
    expect(body.party_size).toBe(2);
    expect(body.trip_type).toBe("couple");
    expect(body.pace).toBe("medium");
  });

  it("should_map_drive_walk_transit_to_stable_key", () => {
    const parsed = planTripBffBody.parse({
      city: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "luxury",
      tripType: "情侣浪漫",
      pace: "medium",
      transit: "drive_walk",
    });
    expect(toAgentPlanTripBody(parsed).transit_preference).toBe("drive_walk");
    expect(toAgentPlanTripBody(parsed).budget).toBe("luxury");
  });

  it("should_map_economy_budget_to_economy_key_not_premium", () => {
    const parsed = planTripBffBody.parse({
      city: "Shanghai",
      startDate: "2026-09-20",
      days: 4,
      partySize: 3,
      budget: "comfort",
      tripType: "family_kids",
      pace: "medium",
      transit: "drive_walk",
      locale: "CN",
    });
    expect(toAgentPlanTripBody(parsed).budget).toBe("comfort");
    expect(toAgentPlanTripBody(parsed).budget).not.toBe("premium");
  });

  it("should_map_takeoff_fields_and_trip_id_into_session_criteria", () => {
    const parsed = planTripBffBody.parse({
      city: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "mid",
      tripType: "couple",
      pace: "medium",
      transit: "transit_walk",
      locale: "EN",
    });
    const criteria = criteriaFromPlanTripBody(parsed, { trip_id: "trip-abc", revision: 3 });
    expect(criteria).toMatchObject({
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "mid",
      tripType: "couple",
      pace: "medium",
      transport: "transit_walk",
      locale: "EN",
      tripId: "trip-abc",
      revision: 3,
    });
  });
});
