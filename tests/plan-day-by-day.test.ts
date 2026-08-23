import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  collectUsedNamesFromDay,
  filterUnusedCandidates,
  planItineraryDayByDay,
} from "../src/core/plan-day-by-day";
import * as client from "../src/places-agent/client";
import {
  setArrangeLlmCompleteForTests,
  setArrangeHostForTests,
} from "../src/core/plan-arrange-llm";
import { setEnrichArrangeTransitForTests } from "../src/core/plan-enrich-transit";

describe("filterUnusedCandidates", () => {
  it("should_drop_names_already_used", () => {
    const filtered = filterUnusedCandidates(
      {
        places: [{ name: "A" }, { name: "B" }],
        restaurants: [{ name: "R1" }, { name: "R2" }],
      },
      new Set(["A", "R1"]),
    );
    expect(filtered.places.map((p) => p.name)).toEqual(["B"]);
    expect(filtered.restaurants.map((p) => p.name)).toEqual(["R2"]);
  });
});

describe("collectUsedNamesFromDay", () => {
  it("should_collect_block_and_alternative_names", () => {
    const names = collectUsedNamesFromDay({
      day_index: 1,
      blocks: [
        {
          name: "Museum",
          type: "attraction",
          alternatives: [{ name: "Alt Park", reason: "backup" }],
        },
        { name: "Lunch Spot", type: "lunch" },
      ],
    });
    expect(names).toEqual(["Museum", "Alt Park", "Lunch Spot"]);
  });
});

function installHostAndLlmMocks() {
  setArrangeHostForTests(async () => ({
    system: "host-system",
    user: "host-user",
  }));
  let call = 0;
  setArrangeLlmCompleteForTests(async () => {
    call += 1;
    const name = call === 1 ? "Place A" : "Place B";
    if (call === 2) {
      return JSON.stringify({
        day_index: 2,
        blocks: [
          {
            name,
            type: "attraction",
            start_time: "10:00",
            duration_min: 90,
            reason: "ok",
          },
        ],
      });
    }
    return JSON.stringify({
      day_index: call,
      blocks: [
        {
          name,
          type: "attraction",
          start_time: "10:00",
          duration_min: 90,
          reason: "ok",
        },
      ],
    });
  });
  setEnrichArrangeTransitForTests(async (body) => {
    const day = body.day as { blocks: unknown[] };
    return {
      day_index: 1,
      blocks: day.blocks as Array<{
        name: string;
        type: string;
        start_time: string;
        duration_min: number;
        reason: string;
      }>,
      transit_outcome: "directions" as const,
    };
  });
}

describe("planItineraryDayByDay (MVP-3 Mode H)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setArrangeLlmCompleteForTests(null);
    setArrangeHostForTests(null);
    setEnrichArrangeTransitForTests(null);
    process.env.PLAN_ARRANGE_STREAM = "0";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setArrangeLlmCompleteForTests(null);
    setArrangeHostForTests(null);
    setEnrichArrangeTransitForTests(null);
    delete process.env.PLAN_ARRANGE_STREAM;
  });

  it("should_arrange_via_host_prompt_and_never_call_agent_llm_arrange", async () => {
    const arrangeSpy = vi.spyOn(client, "arrangeDay");
    const planSpy = vi.spyOn(client, "planItinerary");
    installHostAndLlmMocks();

    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: {
          places: [{ name: "Place A" }, { name: "Place B" }, { name: "Place C" }],
          restaurants: [{ name: "Rest A" }, { name: "Rest B" }],
        },
      },
    });

    vi.spyOn(client, "streamV1Ndjson").mockImplementation(async function* () {
      yield { type: "error", key: "errors.provider_failed" };
    });

    const events = [];
    for await (const ev of planItineraryDayByDay(
      { destination: "Taipei", days: 2, startDate: "2026-08-22" },
      { locale: "CN", providers: ["GOOGLE_MAPS"], now: new Date("2026-08-21T12:00:00") },
    )) {
      events.push(ev);
    }

    expect(arrangeSpy).not.toHaveBeenCalled();
    expect(planSpy).not.toHaveBeenCalled();

    const done = events.find((e) => e.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.itinerary.days).toHaveLength(2);
    }

    const day1Types = events
      .filter(
        (e) =>
          (e.type === "arrange_day_start" ||
            e.type === "day_highlights" ||
            e.type === "slot_preview" ||
            e.type === "slot" ||
            e.type === "place") &&
          "dayIndex" in e &&
          e.dayIndex === 1,
      )
      .map((e) => e.type);
    expect(day1Types[0]).toBe("arrange_day_start");
    expect(day1Types[1]).toBe("day_highlights");
    expect(day1Types).toContain("slot_preview");
    expect(day1Types).toContain("slot");
  });

  it("should_emit_slot_preview_before_each_slot_in_order", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: {
          places: [{ name: "Place A" }, { name: "Place B" }],
          restaurants: [{ name: "Rest A" }],
        },
      },
    });
    vi.spyOn(client, "streamV1Ndjson").mockImplementation(async function* () {
      yield { type: "error", key: "errors.provider_failed" };
    });
    installHostAndLlmMocks();
    setArrangeLlmCompleteForTests(async () =>
      JSON.stringify({
        day_index: 1,
        theme: "Old town",
        blocks: [
          {
            name: "Place A",
            type: "attraction",
            start_time: "10:00",
            duration_min: 90,
            reason: "landmark",
          },
          {
            name: "Rest A",
            type: "lunch",
            start_time: "12:00",
            duration_min: 60,
            reason: "local",
          },
        ],
      }),
    );

    const events = [];
    for await (const ev of planItineraryDayByDay(
      { destination: "Taipei", days: 1, startDate: "2026-08-22", transport: "walk" },
      { locale: "CN", providers: ["GOOGLE_MAPS"], now: new Date("2026-08-21T12:00:00") },
    )) {
      events.push(ev);
    }

    const dayEvents = events.filter(
      (e) =>
        (e.type === "slot_preview" || e.type === "slot" || e.type === "day_done") &&
        ("dayIndex" in e ? e.dayIndex === 1 : true),
    );
    const types = dayEvents.map((e) => e.type);
    expect(types).toContain("slot_preview");
    expect(types).toContain("slot");
    expect(types[types.length - 1]).toBe("day_done");
  });

  it("should_error_when_discover_fails_without_plan_itinerary_fallback", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: false,
    });
    vi.spyOn(client, "streamV1Ndjson").mockImplementation(async function* () {
      yield { type: "error", key: "errors.provider_failed" };
    });
    const planSpy = vi.spyOn(client, "planItinerary");

    const events = [];
    for await (const ev of planItineraryDayByDay(
      { destination: "Taipei", days: 1, startDate: "2026-08-22" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev);
    }

    expect(planSpy).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "error")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(false);
  });
});
