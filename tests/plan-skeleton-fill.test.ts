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

  it("should_retry_plan_next_stop_when_provider_failed_transiently", async () => {
    const prevRetry = process.env.PLAN_NEXT_STOP_RETRY_MS;
    process.env.PLAN_NEXT_STOP_RETRY_MS = "0";
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
      data: { trip_id: "t1", revision: 3, data: {} },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      if (planCalls.length === 1) {
        return {
          agent: "places-agent",
          ok: false,
          outcome: { key: "errors.provider_failed" },
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
    try {
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
    } finally {
      if (prevRetry === undefined) delete process.env.PLAN_NEXT_STOP_RETRY_MS;
      else process.env.PLAN_NEXT_STOP_RETRY_MS = prevRetry;
    }

    expect(events).toContain("done");
    expect(events).not.toContain("error");
    expect(planCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("TC-M18-75-01 should_fetch_skeleton_after_make_and_skip_filled_when_stay_envelope_complete", async () => {
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
    expect(fields.some((f) => f?.includes("filled"))).toBe(false);
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

  it("should_call_make_itinerary_when_discover_and_store_candidates_are_empty", async () => {
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { candidates: { places: [], restaurants: [] }, trip_id: "t1", revision: 1 },
    });
    const makeSpy = vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "errors.make_itinerary_failed" },
    });
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

    expect(makeSpy).toHaveBeenCalled();
    expect(events.some((e) => e.type === "error" && e.key === "errors.empty_results")).toBe(false);
    expect(events.some((e) => e.type === "error" && e.key === "errors.make_itinerary_failed")).toBe(
      true,
    );
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

  it("should_error_make_failed_when_make_fails_and_fetch_stay_only", async () => {
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
    expect(err).toMatchObject({ type: "error", key: "errors.make_itinerary_failed" });
    expect(events.some((e) => e.type === "skeleton_done")).toBe(false);
  });

  it("should_error_phase_make_timeout_when_make_aborts", async () => {
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "play.plan.phase_make_timeout" },
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
    expect(err).toMatchObject({ type: "error", key: "play.plan.phase_make_timeout" });
  });

  it("should_pass_used_restaurant_names_after_first_meal (TC-M23-89)", async () => {
    vi.spyOn(client, "geocode").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { lat: 1, lng: 2, crs: "WGS84" },
    });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: { places: [{ name: "Tower" }, { name: "Castle" }], restaurants: [] },
        trip_id: "t1",
        revision: 1,
      },
    });
    const stops = [
      { name: "Hotel", kind: "stay" },
      { name: "Tower", kind: "attraction" },
      { name: "lunch", kind: "meal", meal_slot: "lunch" },
      { name: "Castle", kind: "attraction" },
      { name: "dinner", kind: "meal", meal_slot: "dinner" },
    ];
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { skeleton: { days: [{ day_index: 1, day_theme: "D1", stops }] }, trip_id: "t1", revision: 2 },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: { skeleton: { days: [{ day_index: 1, day_theme: "D1", stops }] } },
      },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      const next = (body as { next_stop?: { name?: string; kind?: string; meal_slot?: string } }).next_stop;
      const isStay = next?.kind === "stay";
      const isMeal = next?.kind === "meal" || next?.meal_slot;
      const name = isMeal
        ? next?.meal_slot === "dinner"
          ? "Dinner House"
          : "Lunch House"
        : (next?.name ?? "?");
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name, kind: isMeal ? "meal" : (next?.kind ?? "attraction"), card: null, deeplinks: {} },
          slot: { start: "09:00", end: isStay ? "09:00" : "12:00" },
          legs: isStay ? [] : [{ mode: "transit", duration_min: 12, recommended: true }],
          next_stop: { name, location: { lat: 1, lng: 2 } },
        },
      };
    });

    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10", dailyStart: "Hotel", budget: "economy" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
    }

    const dinnerCall = planCalls.find((c) => {
      const n = c.next_stop as { meal_slot?: string; name?: string };
      return n?.meal_slot === "dinner" || n?.name === "dinner";
    });
    expect(dinnerCall?.used_restaurant_names).toEqual(expect.arrayContaining(["Lunch House"]));
    expect(dinnerCall?.budget).toBe("budget");
    expect(dinnerCall?.day_stops).toBeTruthy();
  });

  it("should_geocode_city_for_stay_coords_when_no_origin (TC-M23-92-02)", async () => {
    const geoSpy = vi.spyOn(client, "geocode").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
    });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: {
          places: [{ name: "Torre de Belém", location: { lat: 38.6916, lng: -9.216, crs: "WGS84" } }],
          restaurants: [],
        },
        trip_id: "t1",
        revision: 1,
      },
    });
    const stops = [
      { name: "Lisbon", kind: "stay" },
      { name: "Torre de Belém", kind: "attraction" },
    ];
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { skeleton: { days: [{ day_index: 1, day_theme: "D1", stops }] }, trip_id: "t1", revision: 2 },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: { skeleton: { days: [{ day_index: 1, day_theme: "D1", stops }] } },
      },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      const next = (body as { next_stop?: { name?: string; kind?: string } }).next_stop;
      const isStay = next?.kind === "stay" || (body as { origin_mode?: boolean }).origin_mode;
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name: next?.name ?? "?", kind: isStay ? "stay" : "attraction", card: null, deeplinks: {} },
          slot: { start: "09:00", end: isStay ? "09:00" : "10:00" },
          legs: isStay ? [] : [{ mode: "transit", duration_min: 20, recommended: true }],
          next_stop: {
            name: next?.name,
            location: isStay
              ? { lat: 38.7223, lng: -9.1393 }
              : { lat: 38.6916, lng: -9.216 },
          },
        },
      };
    });

    for await (const ev of planItinerarySkeletonFill(
      { destination: "Lisbon", days: 1, startDate: "2026-10-10" },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
    }

    expect(geoSpy).toHaveBeenCalledWith(expect.objectContaining({ query: expect.stringMatching(/Lisbon/i) }));
    const attractionCall = planCalls.find((c) => {
      const n = c.next_stop as { kind?: string; name?: string };
      return n?.kind === "attraction" || n?.name === "Torre de Belém";
    });
    expect(attractionCall).toBeTruthy();
    expect(attractionCall?.origin_mode).not.toBe(true);
    const current = attractionCall?.current_stop as { lat?: number; lng?: number; name?: string };
    expect(typeof current?.lat).toBe("number");
    expect(typeof current?.lng).toBe("number");
    expect(Math.abs((current?.lat ?? 0) - 38.7223)).toBeLessThan(0.01);
  });

  it("should_pass_intake_origin_coords_on_stay_current_stop (TC-M23-92-01)", async () => {
    vi.spyOn(client, "geocode").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { lat: 1, lng: 2, crs: "WGS84" },
    });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: {
          places: [{ name: "Torre de Belém", location: { lat: 38.6916, lng: -9.216, crs: "WGS84" } }],
          restaurants: [],
        },
        trip_id: "t1",
        revision: 1,
      },
    });
    const stops = [
      { name: "Hills Hotel Lisboa", kind: "stay" },
      { name: "Torre de Belém", kind: "attraction" },
    ];
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { skeleton: { days: [{ day_index: 1, day_theme: "D1", stops }] }, trip_id: "t1", revision: 2 },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        data: { skeleton: { days: [{ day_index: 1, day_theme: "D1", stops }] } },
      },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      const next = (body as { next_stop?: { name?: string; kind?: string } }).next_stop;
      const isStay = (body as { origin_mode?: boolean }).origin_mode === true;
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name: next?.name ?? "?", kind: isStay ? "stay" : "attraction", card: null, deeplinks: {} },
          slot: { start: "09:00", end: isStay ? "09:00" : "10:00" },
          legs: isStay ? [] : [{ mode: "transit", duration_min: 25, recommended: true }],
          next_stop: { name: next?.name, location: { lat: 38.7, lng: -9.2 } },
        },
      };
    });

    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        dailyStart: "Hills Hotel Lisboa",
        originLat: 38.73,
        originLng: -9.14,
        timeFrom: "09:00",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
    }

    const attractionCall = planCalls.find((c) => {
      const n = c.next_stop as { name?: string };
      return n?.name === "Torre de Belém";
    });
    expect(attractionCall?.origin_mode).not.toBe(true);
    const current = attractionCall?.current_stop as { lat?: number; lng?: number };
    expect(current?.lat).toBe(38.73);
    expect(current?.lng).toBe(-9.14);
  });

  it("MVP-T5 should_resume_fill_from_trip_skeleton_without_make", async () => {
    const makeSpy = vi.spyOn(client, "makeItinerary");
    const discoverSpy = vi.spyOn(client, "discoverPlaces");
    const tipsSpy = vi.spyOn(client, "travelTips");
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
        trip_id: "t-fill",
        revision: 5,
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body as { fields?: string[] }).fields ?? [];
      if (fields.includes("filled")) {
        return {
          agent: "places-agent",
          ok: true,
          data: {
            trip_id: "t-fill",
            revision: 5,
            data: {
              filled: {
                stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
                slot: { start: "09:00", end: "09:00" },
                legs: [],
              },
            },
          },
        };
      }
      if (fields.includes("artifacts")) {
        return {
          agent: "places-agent",
          ok: true,
          data: {
            trip_id: "t-fill",
            revision: 4,
            data: {
              artifacts: {
                tips: {
                  intro: "Hi",
                  iconic_places: ["Tower"],
                  transit: "tram",
                  clothing: "light",
                  safety: "careful",
                  weather: null,
                },
              },
            },
          },
        };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t-fill",
          revision: 4,
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
            candidates: { places: [{ name: "Tower" }], restaurants: [] },
            constraints: { origin: { name: "Hotel", lat: 38.7, lng: -9.1 } },
          },
        },
      };
    });

    const phases: string[] = [];
    const eventTypes: string[] = [];
    let tipsData: Record<string, unknown> | undefined;
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-fill",
        revision: 4,
        planMode: "fill",
        dailyStart: "Hotel",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      eventTypes.push(ev.type);
      if (ev.type === "phase") phases.push(ev.phase ?? "");
      if (ev.type === "tips") tipsData = ev.data;
      if (ev.type === "error") break;
    }

    expect(makeSpy).not.toHaveBeenCalled();
    expect(discoverSpy).not.toHaveBeenCalled();
    expect(tipsSpy).not.toHaveBeenCalled();
    expect(phases[0]).toBe("filling");
    expect(phases).not.toContain("discovering");
    expect(phases).not.toContain("skeleton");
    expect(eventTypes).toContain("tips");
    expect(tipsData?.intro).toBe("Hi");
    expect(tipsData).not.toHaveProperty("visa");
  });

  it("should_yield_tips_after_fill_when_artifacts_arrive_late", async () => {
    vi.spyOn(client, "travelTips");
    let fillStarted = false;
    vi.spyOn(client, "planNextStop").mockImplementation(async () => {
      fillStarted = true;
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
          slot: { start: "09:00", end: "09:00" },
          legs: [],
          trip_id: "t-hangzhou",
          revision: 5,
        },
      };
    });
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body as { fields?: string[] }).fields ?? [];
      if (fields.includes("artifacts")) {
        const tips = fillStarted
          ? {
              intro: "西湖",
              iconic_places: ["灵隐寺"],
              transit: "地铁",
              clothing: "薄外套",
              safety: "防盗",
              weather: null,
            }
          : null;
        return {
          agent: "places-agent",
          ok: true,
          data: {
            trip_id: "t-hangzhou",
            revision: 4,
            data: tips ? { artifacts: { tips } } : { artifacts: {} },
          },
        };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t-hangzhou",
          revision: 4,
          data: {
            skeleton: {
              days: [
                {
                  day_index: 1,
                  day_theme: "Hangzhou",
                  stops: [
                    { name: "Hotel", kind: "stay" },
                    { name: "西湖", kind: "attraction" },
                  ],
                },
              ],
            },
            candidates: { places: [], restaurants: [] },
            constraints: { origin: { name: "Hotel" } },
          },
        },
      };
    });

    const eventTypes: string[] = [];
    let tipsData: Record<string, unknown> | undefined;
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "杭州",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-hangzhou",
        revision: 4,
        planMode: "fill",
        dailyStart: "Hotel",
      },
      { locale: "CN" },
    )) {
      eventTypes.push(ev.type);
      if (ev.type === "tips") tipsData = ev.data;
      if (ev.type === "error") break;
    }

    expect(client.travelTips).not.toHaveBeenCalled();
    expect(eventTypes.indexOf("tips")).toBeGreaterThan(eventTypes.indexOf("stop_filled"));
    expect(eventTypes.indexOf("tips")).toBeLessThan(eventTypes.indexOf("day_done"));
    expect(eventTypes.indexOf("tips")).toBeLessThan(eventTypes.indexOf("done"));
    expect(tipsData?.intro).toBe("西湖");
  });

  it("should_seed_current_stop_from_day_origin_when_skeleton_has_no_stay", async () => {
    // Hotel skip / stay-less day: first attraction must not omit current_stop (agent Zod).
    const stops = [
      { name: "West Lake", kind: "attraction" },
      { name: "lunch", kind: "meal", meal_slot: "lunch" as const },
    ];
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-nostay",
        revision: 2,
        data: {
          skeleton: { days: [{ day_index: 1, day_theme: "Hangzhou", stops }] },
          candidates: {
            places: [{ name: "West Lake", location: { lat: 30.25, lng: 120.15, crs: "WGS84" } }],
            restaurants: [],
          },
          constraints: { origin: { name: "Hangzhou", lat: 30.27, lng: 120.15 } },
        },
      },
    });
    const planCalls: Record<string, unknown>[] = [];
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      planCalls.push(body as Record<string, unknown>);
      const next = (body as { next_stop?: { name?: string; kind?: string } }).next_stop;
      const originMode = (body as { origin_mode?: boolean }).origin_mode === true;
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: {
            name: next?.name ?? "?",
            kind: next?.kind ?? "attraction",
            card: null,
            deeplinks: {},
          },
          slot: { start: "09:00", end: originMode ? "09:00" : "11:00" },
          legs: originMode ? [] : [{ mode: "transit", duration_min: 15, recommended: true }],
          next_stop: {
            name: next?.name,
            location: { lat: 30.25, lng: 120.15 },
          },
        },
      };
    });

    let sawError = false;
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Hangzhou",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-nostay",
        revision: 2,
        planMode: "fill",
        timeFrom: "09:00",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") {
        sawError = true;
        break;
      }
    }

    expect(sawError).toBe(false);
    const first = planCalls[0];
    expect(first).toBeTruthy();
    expect(first?.origin_mode).not.toBe(true);
    const current = first?.current_stop as { name?: string; kind?: string; end_time?: string };
    expect(current?.name).toBe("Hangzhou");
    expect(current?.kind).toBe("stay");
    expect(current?.end_time).toBe("09:00");
  });

  it("MVP-T5 TD-6 should_map_stop_filled_from_fetch_filled_not_write_envelope", async () => {
    vi.spyOn(client, "geocode").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { lat: 38.72, lng: -9.14, crs: "WGS84" },
    });
    vi.spyOn(client, "discoverPlaces").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        candidates: { places: [{ name: "Torre de Belém" }], restaurants: [] },
        trip_id: "t-td6",
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
              day_theme: "Belém",
              stops: [
                { name: "Hotel", kind: "stay" },
                { name: "Torre de Belém", kind: "attraction" },
              ],
            },
          ],
        },
        trip_id: "t-td6",
        revision: 2,
      },
    });
    let lastNextName = "Hotel";
    vi.spyOn(client, "planNextStop").mockImplementation(async (body) => {
      const next = (body as { next_stop?: { name?: string; kind?: string } }).next_stop;
      const name = next?.name ?? "Hotel";
      lastNextName = name;
      // Stale / wrong envelope — must NOT become stop_filled SoT.
      return {
        agent: "places-agent",
        ok: true,
        data: {
          stop: { name: `WRONG-${name}`, kind: next?.kind ?? "stay", card: null, deeplinks: {} },
          slot: { start: "01:00", end: "02:00" },
          legs:
            name === "Torre de Belém"
              ? [{ mode: "walk", duration_min: 99, recommended: true }]
              : [],
          trip_id: "t-td6",
          revision: 3,
        },
      };
    });
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body as { fields?: string[] }).fields ?? [];
      if (fields.includes("filled")) {
        const isAttraction = lastNextName === "Torre de Belém";
        return {
          agent: "places-agent",
          ok: true,
          data: {
            trip_id: "t-td6",
            revision: 4,
            data: {
              filled: isAttraction
                ? {
                    stop: {
                      name: "Torre de Belém",
                      kind: "attraction",
                      card: {
                        name: "Torre de Belém",
                        photos: ["https://cdn.example.com/belem.jpg"],
                      },
                      deeplinks: {},
                    },
                    slot: { start: "09:30", end: "11:00" },
                    legs: [{ mode: "walk", duration_min: 12, recommended: true }],
                  }
                : {
                    stop: {
                      name: "Hotel",
                      kind: "stay",
                      card: null,
                      deeplinks: {},
                    },
                    slot: { start: "09:00", end: "09:00" },
                    legs: [],
                  },
              cursor: { day_index: 1, stop_index: isAttraction ? 1 : 0 },
            },
          },
        };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t-td6",
          revision: 2,
          data: {
            skeleton: {
              days: [
                {
                  day_index: 1,
                  day_theme: "Belém",
                  stops: [
                    { name: "Hotel", kind: "stay" },
                    { name: "Torre de Belém", kind: "attraction" },
                  ],
                },
              ],
            },
            candidates: { places: [{ name: "Torre de Belém" }], restaurants: [] },
          },
        },
      };
    });

    const stopFilled: Array<{ name?: string; start?: string; end?: string }> = [];
    const transitTexts: string[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        dailyStart: "Hotel",
        timeFrom: "09:00",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
      if (ev.type === "stop_filled" && ev.slot.kind === "place") {
        stopFilled.push({
          name: ev.slot.name,
          start: ev.slot.start,
          end: ev.slot.end,
        });
      }
      if (ev.type === "transit" && ev.slot.kind === "transit") {
        transitTexts.push(ev.slot.text);
      }
    }

    const attraction = stopFilled.find((s) => s.name === "Torre de Belém");
    expect(attraction).toBeTruthy();
    expect(attraction?.start).toBe("09:30");
    expect(attraction?.end).toBe("11:00");
    expect(stopFilled.some((s) => s.name?.startsWith("WRONG-"))).toBe(false);
    expect(transitTexts.some((t) => t.includes("12"))).toBe(true);
    expect(transitTexts.some((t) => t.includes("99"))).toBe(false);
  });

  it("should_skip_fetch_trip_details_filled_when_envelope_has_display", async () => {
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
        revision: 1,
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
    const fetchSpy = vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 2, data: {} },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 2,
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
      },
    });

    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        dailyStart: "Hotel",
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") break;
    }

    const filledFetches = fetchSpy.mock.calls.filter((call) => {
      const fields = (call[0] as { fields?: string[] })?.fields;
      return fields?.includes("filled");
    });
    expect(filledFetches).toHaveLength(0);
  });
});

describe("2play-plan-94a visa write", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(client, "travelTips").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3 },
    });
    vi.spyOn(client, "planNextStop").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs: [],
        trip_id: "t-visa",
        revision: 5,
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
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
          candidates: { places: [], restaurants: [] },
          artifacts: {
            visa: {
              passport: "CHN",
              destination: "PRT",
              requirement: "visa_free",
              description: "Fetched visa text",
            },
          },
        },
      },
    });
  });

  it("should_write_visa_when_passport_and_destination_country_known", async () => {
    const visaSpy = vi.spyOn(client, "visaRequirement").mockImplementation(async () => {
      expect(tipsBeforeVisa).toBe(true);
      return {
        agent: "places-agent",
        ok: true,
        data: { trip_id: "t-visa", revision: 6, requirement: "from_http_body" },
      };
    });
    const fetchSpy = vi.spyOn(client, "fetchTripDetails");
    let tipsBeforeVisa = false;

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-visa",
        planMode: "fill",
        passportAlpha3: "CHN",
        destinationCountryAlpha3: "PRT",
      },
      { locale: "EN" },
    )) {
      events.push(ev);
      if (ev.type === "tips") tipsBeforeVisa = true;
      if (ev.type === "error" || ev.type === "done") break;
    }

    expect(visaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        passport: "CHN",
        destination: "PRT",
        trip_id: "t-visa",
      }),
    );
    const artifactFetches = fetchSpy.mock.calls.filter((call) => {
      const fields = (call[0] as { fields?: string[] })?.fields;
      return fields?.includes("artifacts");
    });
    expect(artifactFetches.length).toBeGreaterThan(0);
    const fetched = (await fetchSpy.mock.results[0]?.value) as {
      data?: { data?: { artifacts?: { visa?: { requirement?: string } } } };
    };
    expect(fetched.data?.data?.artifacts?.visa?.requirement).toBe("visa_free");
    expect(JSON.stringify(events)).not.toContain("from_http_body");
    const tipsEv = events.find((e) => e.type === "tips") as
      | { type: "tips"; data?: { visa?: { passport?: string; requirement?: string } } }
      | undefined;
    expect(tipsEv?.data?.visa?.passport).toBe("CHN");
    expect(tipsEv?.data?.visa?.requirement).toBe("visa_free");
  });

  it("should_skip_visa_when_destination_country_missing", async () => {
    const visaSpy = vi.spyOn(client, "visaRequirement").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t-visa", revision: 6 },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
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
          candidates: { places: [], restaurants: [] },
          artifacts: { tips: { intro: "Hi" } },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-visa",
        planMode: "fill",
        passportAlpha3: "CHN",
      },
      { locale: "EN" },
    )) {
      events.push(ev);
      if (ev.type === "error" || ev.type === "done") break;
    }

    expect(visaSpy).not.toHaveBeenCalled();
    const blob = JSON.stringify(events);
    expect(blob).not.toContain("play.plan.travel_tips_visa_need_nationality");
    expect(blob).not.toContain("visa_notice");
    expect(blob).not.toContain("visa_free");
  });

  it("should_yield_nationality_notice_without_calling_visa_when_passport_missing", async () => {
    const visaSpy = vi.spyOn(client, "visaRequirement").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t-visa", revision: 6, requirement: "visa_free" },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
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
          candidates: { places: [], restaurants: [] },
          artifacts: { tips: { intro: "Hi" } },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-visa",
        planMode: "fill",
        destinationCountryAlpha3: "PRT",
      },
      { locale: "EN" },
    )) {
      events.push(ev);
      if (ev.type === "error" || ev.type === "done") break;
    }

    expect(visaSpy).not.toHaveBeenCalled();
    const tipsEv = events.find((e) => e.type === "tips") as
      | { type: "tips"; data?: { visa?: unknown; visa_notice?: { key?: string; href?: string } } }
      | undefined;
    expect(tipsEv?.data?.visa_notice).toEqual({
      key: "play.plan.travel_tips_visa_need_nationality",
      href: "/profile",
    });
    expect(tipsEv?.data?.visa).toBeUndefined();
    expect(JSON.stringify(events)).not.toContain("visa_free");
  });

  it("should_yield_unavailable_notice_when_visa_quota_fails", async () => {
    const visaSpy = vi.spyOn(client, "visaRequirement").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "errors.visa_quota_exceeded" },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
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
          candidates: { places: [], restaurants: [] },
          artifacts: {
            tips: { intro: "Hi" },
            visa: {
              unavailable: true,
              outcome: "errors.visa_quota_exceeded",
              requirement: "visa_free",
              visa_free_days: 90,
              description: "Invented policy",
            },
          },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Lisbon",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-visa",
        planMode: "fill",
        passportAlpha3: "CHN",
        destinationCountryAlpha3: "PRT",
      },
      { locale: "EN" },
    )) {
      events.push(ev);
      if (ev.type === "error" || ev.type === "done") break;
    }

    expect(visaSpy).toHaveBeenCalled();
    expect(events.some((e) => e.type === "error")).toBe(false);
    const tipsEv = events.find((e) => e.type === "tips") as
      | { type: "tips"; data?: { visa?: unknown; visa_notice?: { key?: string } } }
      | undefined;
    expect(tipsEv?.data?.visa).toBeUndefined();
    expect(tipsEv?.data?.visa_notice).toEqual({
      key: "play.plan.travel_tips_visa_unavailable",
    });
    const blob = JSON.stringify(events);
    expect(blob).not.toContain("visa_free");
    expect(blob).not.toContain("Invented policy");
    expect(blob).not.toContain("90");
  });

  it("should_skip_visa_when_passport_equals_destination_country", async () => {
    const visaSpy = vi.spyOn(client, "visaRequirement").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
        requirement: "visa_free",
        visa_free_days: 90,
      },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
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
          candidates: { places: [], restaurants: [] },
          artifacts: { tips: { intro: "Hi" } },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Beijing",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-visa",
        planMode: "fill",
        passportAlpha3: "CHN",
        destinationCountryAlpha3: "CHN",
      },
      { locale: "EN" },
    )) {
      events.push(ev);
      if (ev.type === "error" || ev.type === "done") break;
    }

    expect(visaSpy).not.toHaveBeenCalled();
    const blob = JSON.stringify(events);
    expect(blob).not.toContain("visa_free");
    expect(blob).not.toContain("visa_notice");
    expect(blob).not.toContain("play.plan.travel_tips_visa_need_nationality");
  });

  it("should_yield_visa_free_singapore_without_inventing_arrival_card", async () => {
    vi.spyOn(client, "visaRequirement").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t-visa", revision: 6 },
    });
    vi.spyOn(client, "fetchTripDetails").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t-visa",
        revision: 6,
        data: {
          skeleton: {
            days: [
              {
                day_index: 1,
                stops: [
                  { name: "Hotel", kind: "stay" },
                  { name: "Marina Bay", kind: "attraction" },
                ],
              },
            ],
          },
          candidates: { places: [], restaurants: [] },
          artifacts: {
            tips: { intro: "City state." },
            visa: {
              passport: "CHN",
              destination: "SGP",
              requirement: "visa_free",
              visa_free_days: 30,
              description: "Up to 30 days.",
            },
          },
        },
      },
    });

    const events: SkeletonPlanProgressEvent[] = [];
    for await (const ev of planItinerarySkeletonFill(
      {
        destination: "Singapore",
        days: 1,
        startDate: "2026-10-10",
        tripId: "t-visa",
        planMode: "fill",
        passportAlpha3: "CHN",
        destinationCountryAlpha3: "SGP",
      },
      { locale: "EN" },
    )) {
      events.push(ev);
      if (ev.type === "error" || ev.type === "done") break;
    }

    const tipsEv = events.find((e) => e.type === "tips") as
      | { type: "tips"; data?: { visa?: { requirement?: string; visa_free_days?: number } } }
      | undefined;
    expect(tipsEv?.data?.visa?.requirement).toBe("visa_free");
    expect(tipsEv?.data?.visa?.visa_free_days).toBe(30);
    expect(JSON.stringify(events)).not.toMatch(/arrival.?card|SGAC|入境卡/i);
  });
});
