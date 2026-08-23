import { describe, expect, it } from "vitest";
import { validatePlanBoundaries } from "../src/core/plan-validate";
import {
  buildArrangeDayBody,
  buildDiscoverPlacesBody,
  buildPlanItineraryBody,
  planDayDates,
  ymdPlusDays,
} from "../src/core/plan-agent-body";

describe("validatePlanBoundaries", () => {
  it("should_require_destination_days_and_startDate", () => {
    const res = validatePlanBoundaries({ destination: "", days: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.destination).toBeTruthy();
      expect(res.errors.days).toBeTruthy();
      expect(res.errors.startDate).toBeTruthy();
    }
  });

  it("should_reject_invalid_startDate", () => {
    const res = validatePlanBoundaries({
      destination: "Taipei",
      days: 3,
      startDate: "2026-13-40",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.startDate).toBeTruthy();
  });

  it("should_accept_valid_boundaries", () => {
    const res = validatePlanBoundaries({
      destination: "Taipei",
      days: 3,
      startDate: "2026-08-22",
      interests: ["museum"],
      constraints: "wheelchair",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.destination).toBe("Taipei");
      expect(res.value.days).toBe(3);
      expect(res.value.startDate).toBe("2026-08-22");
      expect(res.value.interests).toEqual(["museum"]);
    }
  });

  it("should_reject_time_order_when_both_set", () => {
    const res = validatePlanBoundaries({
      destination: "Taipei",
      days: 2,
      startDate: "2026-08-22",
      timeFrom: "18:00",
      timeTo: "09:00",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.timeTo).toBeTruthy();
  });

  it("should_normalize_unpadded_times_before_compare_TC_M3r_34_02", () => {
    // "9:00" vs "10:00": naive string compare wrongly rejects ("10:00" <= "9:00").
    const res = validatePlanBoundaries({
      destination: "Taipei",
      days: 2,
      startDate: "2026-08-22",
      timeFrom: "9:00",
      timeTo: "10:00",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.timeFrom).toBe("09:00");
      expect(res.value.timeTo).toBe("10:00");
    }
  });

  it("should_normalize_and_reject_reversed_unpadded_times_TC_M3r_34_02", () => {
    const res = validatePlanBoundaries({
      destination: "Taipei",
      days: 2,
      startDate: "2026-08-22",
      timeFrom: "20:00",
      timeTo: "9:30",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.timeTo).toBeTruthy();
  });

  it("should_keep_padded_times_unchanged_TC_M3r_34_02", () => {
    const res = validatePlanBoundaries({
      destination: "Taipei",
      days: 2,
      startDate: "2026-08-22",
      timeFrom: "09:30",
      timeTo: "20:00",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.timeFrom).toBe("09:30");
      expect(res.value.timeTo).toBe("20:00");
    }
  });
});

describe("buildPlanItineraryBody", () => {
  it("should_set_bounds_from_startDate_and_days", () => {
    const body = buildPlanItineraryBody(
      { destination: "Taipei", days: 3, startDate: "2026-08-22", pace: "轻松", budget: "经济" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    );
    expect(body.detail).toBe("timed");
    expect(body.bounds).toEqual({
      start: "2026-08-22",
      end: "2026-08-25",
    });
    expect((body.preferences as { pace?: string }).pace).toBe("relaxed");
    expect((body.preferences as { spend?: string }).spend).toBe("budget");
  });

  it("should_map_daily_pins_and_walk_transport", () => {
    const body = buildPlanItineraryBody(
      {
        destination: "Taipei",
        days: 1,
        startDate: "2026-08-22",
        dailyStart: "Hotel X",
        dailyEnd: "Station Y",
        transport: "步行优先",
        budget: "舒适",
        pace: "紧凑",
        tripType: "美食之旅",
        interests: ["museum"],
        constraints: "slow",
      },
      { locale: "CN", providers: ["GOOGLE_MAPS"] },
    );
    expect(body.origin).toEqual({ name: "Hotel X" });
    expect(body.destination).toEqual({ name: "Station Y" });
    const prefs = body.preferences as {
      transit_preferred?: boolean;
      spend?: string;
      pace?: string;
      natural_language?: string;
    };
    expect(prefs.transit_preferred).toBe(false);
    expect(prefs.spend).toBe("premium");
    expect(prefs.pace).toBe("tight");
    expect(prefs.natural_language).toContain("Taipei");
  });
});

describe("discover_and_arrange_bodies", () => {
  it("should_pass_numDays_and_bounds_from_startDate", () => {
    const body = buildDiscoverPlacesBody(
      { destination: "台北", days: 3, startDate: "2026-08-22" },
      { locale: "CN", providers: ["GOOGLE_MAPS"] },
    );
    expect(body.numDays).toBe(3);
    expect(body.bounds).toEqual({ start: "2026-08-22", end: "2026-08-25" });
  });

  it("should_include_time_prefs_and_exclude_names_on_arrange", () => {
    const body = buildArrangeDayBody(
      {
        destination: "台北",
        days: 3,
        startDate: "2026-08-22",
        timeFrom: "09:00",
        timeTo: "21:00",
      },
      {
        locale: "CN",
        providers: ["GOOGLE_MAPS"],
        dayIndex: 2,
        date: "2026-08-23",
        candidates: { places: [], restaurants: [] },
        excludeNames: ["故宫"],
      },
    );
    expect(body.date).toBe("2026-08-23");
    expect(body.exclude_names).toEqual(["故宫"]);
    expect((body.preferences as { time_from?: string }).time_from).toBe("09:00");
  });

  it("should_derive_planDayDates_from_startDate", () => {
    expect(planDayDates(3, "2026-08-22")).toEqual([
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
    ]);
    expect(ymdPlusDays("2026-08-22", 3)).toBe("2026-08-25");
  });
});
