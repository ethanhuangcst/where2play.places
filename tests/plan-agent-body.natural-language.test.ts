/**
 * TC-M3r-34-01 — plan-14 boundary passthrough into arrange_day body.
 */
import { describe, expect, it } from "vitest";
import { buildArrangeDayBody } from "../src/core/plan-agent-body";
import type { PlanBoundaries } from "../src/core/itinerary-types";

const base: PlanBoundaries = {
  destination: "里斯本",
  days: 4,
  startDate: "2026-09-20",
};

function arrangeBody(criteria: PlanBoundaries): Record<string, unknown> {
  return buildArrangeDayBody(criteria, {
    locale: "CN",
    providers: ["GOOGLE_MAPS"],
    dayIndex: 1,
    date: "2026-09-20",
    candidates: { places: [], restaurants: [] },
  });
}

describe("TC-M3r-34-01 buildArrangeDayBody natural_language", () => {
  it("should_join_trip_type_interests_constraints_into_natural_language", () => {
    const body = arrangeBody({
      ...base,
      tripType: "情侣出游",
      interests: ["老城", "海边"],
      constraints: "不吃辣",
    });

    const preferences = body.preferences as Record<string, unknown>;
    expect(preferences.natural_language).toContain("情侣出游");
    expect(preferences.natural_language).toContain("老城");
    expect(preferences.natural_language).toContain("海边");
    expect(preferences.natural_language).toContain("不吃辣");
  });

  it("should_not_use_preferences_interests_dead_field", () => {
    const body = arrangeBody({
      ...base,
      tripType: "情侣出游",
      interests: ["老城"],
    });

    const preferences = body.preferences as Record<string, unknown>;
    expect(preferences.interests).toBeUndefined();
  });

  it("should_omit_natural_language_when_no_preference_parts", () => {
    const body = arrangeBody({ ...base });

    expect(body.preferences).toBeUndefined();
  });

  it("should_keep_existing_passthrough_fields_when_joining", () => {
    const body = arrangeBody({
      ...base,
      tripType: "情侣出游",
      pace: "适中",
      budget: "中等",
      partySize: 2,
      timeFrom: "09:30",
      timeTo: "20:00",
      transport: "步行优先",
    });

    expect(body.pace).toBe("medium");
    expect(body.budget).toBeUndefined(); // mapSpend("中等") → undefined, not forced
    const preferences = body.preferences as Record<string, unknown>;
    expect(preferences.time_from).toBe("09:30");
    expect(preferences.time_to).toBe("20:00");
    expect(preferences.transit_preferred).toBe(false);
    expect(preferences.natural_language).toContain("情侣出游");
    expect(body.party_size).toBe(2);
  });
});
