import { describe, expect, it, afterEach, beforeEach } from "vitest";
import {
  buildArrangeDayMessages,
  parseArrangeDayModelText,
  slimCandidateForSchedule,
  attachPhotosFromCandidates,
  setArrangeLlmCompleteForTests,
  setArrangeHostForTests,
  completeArrangeDay,
} from "../src/core/plan-arrange-llm";

describe("plan-arrange-llm", () => {
  afterEach(() => {
    setArrangeLlmCompleteForTests(null);
    setArrangeHostForTests(null);
    process.env.PLAN_ARRANGE_STREAM = "0";
  });

  beforeEach(() => {
    setArrangeHostForTests(async () => ({ system: "host", user: "user" }));
    process.env.PLAN_ARRANGE_STREAM = "0";
  });

  it("should_strip_photos_hours_sources_from_slim_candidate", () => {
    const slim = slimCandidateForSchedule({
      name: "Museum",
      category: "museum",
      rating: 4.5,
      hours: "09:00-17:00",
      photos: ["https://cdn.example/a.jpg"],
      sources: [{ provider: "GOOGLE_MAPS", native_id: "x", deeplinks: {} }],
      location: { lat: 25.0, lng: 121.5 },
    });
    expect(slim.name).toBe("Museum");
    expect(slim.category).toBe("museum");
    expect(slim.photos).toBeUndefined();
    expect(slim.hours).toBeUndefined();
    expect(slim.sources).toBeUndefined();
    expect(JSON.stringify(slim)).not.toMatch(/cdn\.example|09:00/);
  });

  it("should_build_prompt_without_photo_urls", () => {
    const { user, system } = buildArrangeDayMessages({
      locale: "CN",
      city: "Taipei",
      dayIndex: 1,
      date: "2026-08-22",
      criteria: { destination: "Taipei", days: 2, startDate: "2026-08-22", pace: "medium" },
      candidates: {
        places: [
          {
            name: "Museum",
            category: "museum",
            photos: ["https://cdn.example/secret.jpg"],
            hours: "closed",
          },
        ],
        restaurants: [{ name: "Noodle", category: "food" }],
      },
    });
    expect(user).toContain("Museum");
    expect(user).toContain("Noodle");
    expect(user).not.toContain("cdn.example");
    expect(user).not.toContain("closed");
    expect(system).toContain("theme");
    expect(system).toMatch(/landmark cluster|同|geographically/i);
  });

  it("should_include_party_size_in_arrange_prompt_constraints", () => {
    const { user } = buildArrangeDayMessages({
      locale: "EN",
      city: "Lisbon",
      dayIndex: 1,
      criteria: {
        destination: "Lisbon",
        days: 2,
        startDate: "2026-09-01",
        partySize: 4,
      },
      candidates: { places: [{ name: "Castelo" }], restaurants: [] },
    });
    expect(user).toContain("party_size: 4");
  });

  it("should_include_up_to_sixteen_candidates_in_prompt", () => {
    const places = Array.from({ length: 20 }, (_, i) => ({
      name: `Place ${i}`,
      category: "museum",
    }));
    const { user } = buildArrangeDayMessages({
      locale: "CN",
      city: "西安",
      dayIndex: 1,
      criteria: { destination: "西安", days: 3, startDate: "2026-08-22" },
      candidates: { places, restaurants: [] },
    });
    expect(user).toContain("Place 0");
    expect(user).toContain("Place 15");
    expect(user).not.toContain("Place 16");
    expect(user).toContain("Attraction candidates (16)");
  });

  it("should_parse_theme_on_valid_day_json", () => {
    const names = new Set(["Museum"]);
    const ok = parseArrangeDayModelText(
      JSON.stringify({
        day_index: 1,
        theme: "古城核心",
        blocks: [
          {
            name: "Museum",
            type: "attraction",
            start_time: "10:00",
            duration_min: 90,
            reason: "iconic",
          },
        ],
      }),
      { dayIndex: 1, candidateNames: names },
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.theme).toBe("古城核心");
  });

  it("should_parse_valid_day_json_and_reject_unknown_names", () => {
    const names = new Set(["Museum", "Noodle"]);
    const ok = parseArrangeDayModelText(
      JSON.stringify({
        day_index: 1,
        blocks: [
          {
            name: "Museum",
            type: "attraction",
            start_time: "10:00",
            duration_min: 90,
            reason: "iconic",
          },
        ],
      }),
      { dayIndex: 1, candidateNames: names },
    );
    expect(ok.ok).toBe(true);

    const bad = parseArrangeDayModelText(
      JSON.stringify({
        blocks: [
          {
            name: "Fake Spot",
            type: "attraction",
            start_time: "10:00",
            duration_min: 60,
            reason: "nope",
          },
        ],
      }),
      { dayIndex: 1, candidateNames: names },
    );
    expect(bad.ok).toBe(false);
  });

  it("should_attach_photos_from_original_candidates", () => {
    const day = attachPhotosFromCandidates(
      {
        day_index: 1,
        blocks: [
          {
            name: "Museum",
            type: "attraction",
            start_time: "10:00",
            duration_min: 90,
            reason: "ok",
          },
        ],
      },
      {
        places: [{ name: "Museum", photos: ["https://cdn.example/cover.jpg"] }],
        restaurants: [],
      },
    );
    expect(day.blocks[0]?.photos).toEqual(["https://cdn.example/cover.jpg"]);
  });

  it("should_complete_arrange_day_via_test_inject", async () => {
    setArrangeLlmCompleteForTests(async () =>
      JSON.stringify({
        day_index: 1,
        blocks: [
          {
            name: "Place A",
            type: "attraction",
            start_time: "10:00",
            duration_min: 90,
            reason: "ok",
          },
        ],
      }),
    );
    const result = await completeArrangeDay({
      locale: "EN",
      city: "Taipei",
      dayIndex: 1,
      date: "2026-08-22",
      criteria: { destination: "Taipei", days: 1, startDate: "2026-08-22" },
      providers: ["GOOGLE_MAPS"],
      candidates: {
        places: [{ name: "Place A", photos: ["https://cdn.example/p.jpg"] }],
        restaurants: [],
      },
    });
    expect(result.blocks[0]?.name).toBe("Place A");
    expect(result.blocks[0]?.photos).toEqual(["https://cdn.example/p.jpg"]);
  });

  it("should_normalize_single_digit_hours_on_parse_TC_M3r_34_03", () => {
    const names = new Set(["Museum"]);
    const ok = parseArrangeDayModelText(
      JSON.stringify({
        day_index: 1,
        blocks: [
          { name: "Museum", type: "attraction", start_time: "9:30", duration_min: 90, reason: "ok" },
        ],
      }),
      { dayIndex: 1, candidateNames: names },
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.blocks[0]?.start_time).toBe("09:30");
  });

  it("should_retry_once_when_first_block_before_timeFrom_TC_M3r_34_04", async () => {
    let calls = 0;
    setArrangeLlmCompleteForTests(async () => {
      calls += 1;
      // First attempt starts late (10:00), retry must comply with timeFrom 09:30.
      const start = calls === 1 ? "10:00" : "09:30";
      return JSON.stringify({
        day_index: 1,
        blocks: [
          { name: "Place A", type: "attraction", start_time: start, duration_min: 90, reason: "ok" },
        ],
      });
    });
    const result = await completeArrangeDay({
      locale: "EN",
      city: "Taipei",
      dayIndex: 1,
      date: "2026-08-22",
      criteria: {
        destination: "Taipei",
        days: 1,
        startDate: "2026-08-22",
        timeFrom: "09:30",
      },
      providers: ["GOOGLE_MAPS"],
      candidates: { places: [{ name: "Place A" }], restaurants: [] },
    });
    expect(calls).toBe(2);
    expect(result.blocks[0]?.start_time).toBe("09:30");
  });

  it("should_pass_without_retry_when_first_block_within_grace_TC_M3r_34_04", async () => {
    let calls = 0;
    setArrangeLlmCompleteForTests(async () => {
      calls += 1;
      return JSON.stringify({
        day_index: 1,
        blocks: [
          { name: "Place A", type: "attraction", start_time: "09:27", duration_min: 90, reason: "ok" },
        ],
      });
    });
    const result = await completeArrangeDay({
      locale: "EN",
      city: "Taipei",
      dayIndex: 1,
      date: "2026-08-22",
      criteria: {
        destination: "Taipei",
        days: 1,
        startDate: "2026-08-22",
        timeFrom: "09:30",
      },
      providers: ["GOOGLE_MAPS"],
      candidates: { places: [{ name: "Place A" }], restaurants: [] },
    });
    expect(calls).toBe(1);
    expect(result.blocks[0]?.start_time).toBe("09:27");
  });

  it("should_not_enforce_start_when_no_timeFrom_TC_M3r_34_04", async () => {
    let calls = 0;
    setArrangeLlmCompleteForTests(async () => {
      calls += 1;
      return JSON.stringify({
        day_index: 1,
        blocks: [
          { name: "Place A", type: "attraction", start_time: "10:00", duration_min: 90, reason: "ok" },
        ],
      });
    });
    const result = await completeArrangeDay({
      locale: "EN",
      city: "Taipei",
      dayIndex: 1,
      date: "2026-08-22",
      criteria: { destination: "Taipei", days: 1, startDate: "2026-08-22" },
      providers: ["GOOGLE_MAPS"],
      candidates: { places: [{ name: "Place A" }], restaurants: [] },
    });
    expect(calls).toBe(1);
    expect(result.blocks[0]?.start_time).toBe("10:00");
  });
});
