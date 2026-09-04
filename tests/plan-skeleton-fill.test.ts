import { describe, expect, it, vi, beforeEach } from "vitest";
import { planItinerarySkeletonFill, planPipelineMode, type SkeletonPlanProgressEvent } from "../src/core/plan-skeleton-fill";
import * as client from "../src/places-agent/client";

describe("plan pipeline mode", () => {
  it("should_default_to_skeleton_pipeline", () => {
    const prev = process.env.PLAN_PIPELINE;
    delete process.env.PLAN_PIPELINE;
    expect(planPipelineMode()).toBe("skeleton");
    process.env.PLAN_PIPELINE = prev;
  });
});

describe("plan-skeleton-fill orchestrator (TC-M10-46-01/02)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(client, "travelTips").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3, iconic_places: ["Tower"] },
    });
  });

  it("should_send_agent_enums_to_make_itinerary", async () => {
    const makeSpy = vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: {
          days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
        },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "geocode").mockResolvedValue({ agent: "places-agent", ok: true, data: { lat: 1, lng: 2, crs: "WGS84" } });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [{ name: "Tower" }], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} }, slot: { start: "09:00", end: "09:00" }, legs: [] },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: {
          skeleton: {
            days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
          },
        },
      },
    });

    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        pace: "Balanced",
        budget: "$ Economy",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
    }

    expect(makeSpy).toHaveBeenCalled();
    const body = makeSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.pace).toBe("medium");
    expect(body.budget).toBe("budget");
  });

  it("should_not_call_arrange_day_or_enrich", async () => {
    const arrangeSpy = vi.spyOn(client, "arrangeDay");
    const enrichSpy = vi.spyOn(client, "enrichArrangeTransit");
    vi.spyOn(client, "geocode").mockResolvedValue({ agent: "places-agent", ok: true, data: { lat: 1, lng: 2, crs: "WGS84" } });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: { places: [{ name: "Tower" }], restaurants: [] },
        trip_id: "t1",
        revision: 1,
      },
    });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: {
          days: [
            {
              day_index: 1,
              day_theme: "Day 1",
              stops: [
                { name: "Hotel", kind: "stay" },
                { name: "Tower", kind: "attraction" },
              ],
            },
          ],
        },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: {
          skeleton: {
            days: [
              {
                day_index: 1,
                day_theme: "Day 1",
                stops: [
                  { name: "Hotel", kind: "stay" },
                  { name: "Tower", kind: "attraction" },
                ],
              },
            ],
          },
        },
      },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      const next = (body as { next_stop?: { name?: string; kind?: string } }).next_stop;
      const isStay = next?.kind === "stay";
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name: next?.name ?? "?", kind: next?.kind ?? "attraction", card: null, deeplinks: {} },
          slot: { start: "9:00", end: isStay ? "9:00" : "11:00" },
          legs: isStay ? [] : [{ mode: "walk", duration_min: 10, recommended: true }],
          legs_to_here: [],
        },
      };
    });

    const events: string[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        dailyStart: "Hotel",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev.type);
      if (ev.type === "error") break;
    }

    expect(arrangeSpy).not.toHaveBeenCalled();
    expect(enrichSpy).not.toHaveBeenCalled();
    expect(events).toContain("skeleton_start");
    expect(events).toContain("stop_filled");
    expect(events).toContain("done");
    const secondCall = planCalls[1] as {
      current_stop?: { end_time?: string };
      previous_stop?: { end_time?: string };
    };
    expect(secondCall?.current_stop?.end_time).toBe("09:00");
    expect(secondCall?.previous_stop?.end_time).toBe("09:00");
  });

  it("should_retry_plan_next_stop_with_revision_from_fetch_trip_details", async () => {
    vi.spyOn(client, "geocode").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { lat: 1, lng: 2, crs: "WGS84" },
    });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: { places: [{ name: "Tower" }], restaurants: [] },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: {
          days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
        },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 7, data: {} },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      if (planCalls.length === 1) {
        return {
          agent: "places-agent",
          ok: false,
          outcome: { key: "errors.trip_revision_conflict" },
        };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
          slot: { start: "09:00", end: "09:00" },
          legs: [],
        },
      };
    });

    const events: string[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        dailyStart: "Hotel",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev.type);
      if (ev.type === "error") break;
    }

    expect(events).toContain("done");
    expect(planCalls).toHaveLength(2);
    expect(planCalls[0]?.revision).toBe(7);
    expect(planCalls[1]?.revision).toBe(7);
    expect(client.fetchTripDetails).toHaveBeenCalled();
  });

  it("TC-M18-75-01 should_fetch_skeleton_after_make_and_filled_after_plan_next_stop", async () => {
    vi.spyOn(client, "geocode").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { lat: 1, lng: 2, crs: "WGS84" },
    });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [{ name: "Tower" }], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: { days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }] },
        trip_id: "t1",
        revision: 2,
      },
    });
    const fetchSpy = vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 3,
        data: { skeleton: { days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }] } },
      },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
        trip_id: "t1",
        revision: 3,
      },
    });

    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10", dailyStart: "Hotel" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
    }

    const fields = fetchSpy.mock.calls.map((c) => (c[0] as { fields?: string[] }).fields);
    expect(fields.some((f) => f?.includes("skeleton"))).toBe(true);
    expect(fields.some((f) => f?.includes("filled"))).toBe(true);
  });

  it("should_hydrate_candidates_from_fetch_when_discover_envelope_has_empty_pool", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    const makeSpy = vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: {
          days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }, { name: "Tower" }] }],
        },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body as { fields?: string[] }).fields ?? [];
      if (fields.includes("candidates")) {
        return {
          agent: "places-agent",
          ok: true,
          data: {
            trip_id: "t1",
            revision: 1,
            data: {
              candidates: {
                places: [{ name: "Tower", user_ratings_total: 8000 }],
                restaurants: [],
              },
            },
          },
        };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t1",
          revision: 2,
          data: {
            skeleton: {
              days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }, { name: "Tower" }] }],
            },
            artifacts: { tips: { iconic_places: ["Tower"] } },
          },
        },
      };
    });

    const events: string[] = [];
    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev.type);
      if (ev.type === "error") break;
    }

    expect(makeSpy).toHaveBeenCalled();
    const mkBody = makeSpy.mock.calls[0]?.[0] as { candidates?: { places?: { name?: string }[] } };
    expect(mkBody.candidates?.places?.[0]?.name).toBe("Tower");
    expect(events).toContain("tips");
    expect(events).not.toContain("error");
  });

  it("should_error_when_discover_and_store_candidates_are_empty", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    const makeSpy = vi.spyOn(client, "makeItinerary");
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 1, data: { candidates: { places: [], restaurants: [] } } },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev);
    }

    expect(makeSpy).not.toHaveBeenCalled();
    expect(events).toEqual([{ type: "phase", phase: "discovering" }, { type: "error", key: "errors.empty_results" }]);
  });

  it("should_keep_envelope_skeleton_when_store_has_fewer_stops", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [{ name: "Tower" }], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: {
          days: [
            {
              day_index: 1,
              stops: [
                { name: "Hotel", kind: "stay" },
                { name: "Tower", kind: "attraction" },
              ],
            },
          ],
        },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: {
          skeleton: { days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }] },
        },
      },
    });

    let dayStops: { name: string }[] | undefined;
    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10", dailyStart: "Hotel" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "skeleton_day") dayStops = ev.stops;
      if (ev.type === "error") break;
    }
    expect(dayStops?.map((s) => s.name)).toEqual(["Hotel", "Tower"]);
  });

  it("should_skip_discover_when_trip_id_has_candidates", async () => {
    const discSpy = vi.spyOn(client, "discoverPlaces");
    const tipsSpy = vi.spyOn(client, "travelTips");
    const makeSpy = vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        skeleton: { days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }] },
        trip_id: "t1",
        revision: 2,
      },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body as { fields?: string[] }).fields ?? [];
      if (fields.includes("candidates")) {
        return {
          agent: "places-agent",
          ok: true,
          data: {
            trip_id: "t1",
            revision: 1,
            data: { candidates: { places: [{ name: "Tower", must_see: true }], restaurants: [] } },
          },
        };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t1",
          revision: 3,
          data: {
            skeleton: { days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }] },
            artifacts: { tips: { intro: "Hi", iconic_places: ["Tower"] } },
          },
        },
      };
    });

    const events: string[] = [];
    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10", tripId: "t1", revision: 1 },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev.type);
      if (ev.type === "error") break;
    }

    expect(discSpy).not.toHaveBeenCalled();
    expect(makeSpy).toHaveBeenCalled();
    const makeOrder = makeSpy.mock.invocationCallOrder[0] ?? 0;
    const tipsOrder = tipsSpy.mock.invocationCallOrder[0] ?? 0;
    expect(tipsOrder).toBeGreaterThan(makeOrder);
    const doneAt = events.indexOf("skeleton_done");
    const tipsAt = events.indexOf("tips");
    expect(doneAt).toBeGreaterThanOrEqual(0);
    expect(tipsAt).toBeGreaterThan(doneAt);
    const tipsBody = tipsSpy.mock.calls[0]?.[0] as { skeleton?: unknown };
    expect(tipsBody.skeleton).toBeTruthy();
  });
});

describe("make failure fetch recovery (TC-M19-78-02)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(client, "travelTips").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3, iconic_places: ["Tower"] },
    });
    vi.spyOn(client, "geocode").mockResolvedValue({ agent: "places-agent", ok: true, data: { lat: 1, lng: 2, crs: "WGS84" } });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [{ name: "Tower" }], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
      },
    });
  });

  it("should_continue_fill_when_make_fails_but_fetch_has_fillable_skeleton", async () => {
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "errors.make_itinerary_failed" },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: {
          skeleton: {
            days: [
              {
                day_index: 1,
                stops: [
                  { name: "Hotel", kind: "stay" },
                  { name: "Tower", kind: "attraction" },
                ],
              },
            ],
          },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev);
      if (ev.type === "error") break;
    }

    expect(events.some((e) => e.type === "skeleton_done")).toBe(true);
    expect(events.some((e) => e.type === "error")).toBe(false);
  });

  it("should_error_phase_make_timeout_when_make_fails_and_fetch_stay_only", async () => {
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "errors.make_itinerary_failed" },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: {
          skeleton: { days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }] },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      events.push(ev);
    }

    const err = events.find((e) => e.type === "error");
    expect(err).toEqual({ type: "error", key: "play.plan.phase_make_timeout" });
    expect(events.some((e) => e.type === "skeleton_done")).toBe(false);
  });
});
