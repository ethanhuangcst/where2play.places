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

  it("should_forward_origin_startTime_and_other_to_agent", () => {
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
      originName: "Hills Hotel",
      startTime: "09:30",
      other: "No early flights",
    });
    const body = toAgentPlanTripBody(parsed);
    expect(body.origin).toEqual({ name: "Hills Hotel" });
    expect(body.start_time).toBe("09:30");
    expect(body.other).toBe("No early flights");
  });

  it("should_include_skeleton_only_flag_for_t3 (TC-T3-101-03)", () => {
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
      originName: "Hills Hotel",
      startTime: "09:30",
      skeleton_only: true,
    });
    const body = toAgentPlanTripBody(parsed);
    expect(body.skeleton_only).toBe(true);
    expect(body.providers).toBeUndefined();
    expect(body.party_size).toBe(2);
  });

  it("should_forward_expand_radius_answers_to_agent (TC-T3-104-02)", () => {
    const parsed = planTripBffBody.parse({
      city: "Lisbon",
      startDate: "2026-09-20",
      days: 3,
      partySize: 2,
      budget: "mid",
      tripType: "couple",
      pace: "medium",
      transit: "transit_walk",
      locale: "EN",
      skeleton_only: true,
      trip_id: "trip-expand",
      revision: 1,
      answers: { expand_radius: "yes" },
    });
    const body = toAgentPlanTripBody(parsed);
    expect(body.answers).toEqual({ expand_radius: "yes" });
    expect(body.trip_id).toBe("trip-expand");
    expect(body.revision).toBe(1);
  });

  it("should_forward_hotel_answers_to_agent (MVP-T5 TD-4)", () => {
    const parsed = planTripBffBody.parse({
      city: "西安",
      startDate: "2026-09-20",
      days: 3,
      partySize: 3,
      budget: "mid",
      tripType: "city",
      pace: "tight",
      transit: "transit_walk",
      locale: "CN",
      trip_id: "trip-hotel",
      revision: 1,
      answers: { hotel: "西安钟楼饭店" },
    });
    const body = toAgentPlanTripBody(parsed);
    expect(body.answers).toEqual({ hotel: "西安钟楼饭店" });
  });

  it("should_set_bounds_end_to_start_plus_days_minus_one (TC-T3-BFF-01)", () => {
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
    expect(body.bounds).toEqual({ start: "2026-09-20", end: "2026-09-23" });
  });
});
