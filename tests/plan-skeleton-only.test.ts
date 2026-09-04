import { describe, expect, it, vi, beforeEach } from "vitest";
import { planItinerarySkeletonOnly } from "../src/core/plan-skeleton-only";
import * as client from "../src/places-agent/client";

const criteria = {
  destination: "Lisbon",
  days: 2,
  startDate: "2026-10-10",
  partySize: 2,
  tripType: "Couple",
  tripId: "t1",
  revision: 2,
};

const fillableSkeleton = {
  days: [
    {
      day_index: 1,
      day_theme: "Belem",
      stops: [
        { name: "Hotel", kind: "stay" },
        { name: "Tower", kind: "place" },
      ],
    },
  ],
};

const stayOnly = {
  days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
};

describe("planItinerarySkeletonOnly (TC-M20-41-16/17)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should_fetch_skeleton_after_make_and_not_call_plan_next_stop", async () => {
    vi.spyOn(client, "geocode");
    const makeSpy = vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3, skeleton: fillableSkeleton },
    });
    const fetchSpy = vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body.fields as string[] | undefined) ?? [];
      const data: Record<string, unknown> = {};
      if (fields.includes("candidates")) {
        data.candidates = { places: [{ name: "Tower" }], restaurants: [] };
      }
      if (fields.includes("skeleton")) {
        data.skeleton = fillableSkeleton;
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t1",
          revision: fields.includes("skeleton") ? 4 : 2,
          data,
        },
      };
    });
    const fillSpy = vi.spyOn(client, "planNextStop");
    const discSpy = vi.spyOn(client, "discoverPlaces");

    const events: string[] = [];
    let done: { type: string; tripId?: string; revision?: number } | undefined;
    for await (const ev of planItinerarySkeletonOnly(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    })) {
      events.push(ev.type);
      if (ev.type === "skeleton_done") done = ev;
      if (ev.type === "error") break;
    }

    expect(discSpy).not.toHaveBeenCalled();
    expect(fillSpy).not.toHaveBeenCalled();
    expect(makeSpy).toHaveBeenCalled();
    expect(client.geocode).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "t1", fields: ["candidates"] }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "t1", fields: ["skeleton", "candidates", "constraints"] }),
    );
    expect(events).toContain("skeleton_done");
    expect(events).not.toContain("stop_filled");
    expect(done?.tripId).toBe("t1");
    expect(done?.revision).toBe(4);
  });

  function mockPoolThenSkeleton(skeleton: unknown) {
    vi.spyOn(client, "geocode");
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body.fields as string[] | undefined) ?? [];
      const data: Record<string, unknown> = {
        candidates: { places: [{ name: "Tower" }], restaurants: [] },
      };
      if (fields.includes("skeleton")) data.skeleton = skeleton;
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t1",
          revision: fields.includes("skeleton") ? 4 : 2,
          data,
        },
      };
    });
  }

  it("should_use_fetch_slice_not_make_envelope_when_they_differ", async () => {
    mockPoolThenSkeleton({
      days: [
        {
          day_index: 1,
          day_theme: "FromFetch",
          stops: [
            { name: "Tower", kind: "place" },
            { name: "Market", kind: "meal" },
          ],
        },
      ],
    });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: {
        trip_id: "t1",
        revision: 3,
        skeleton: {
          days: [
            {
              day_index: 1,
              day_theme: "FromMake",
              stops: [
                { name: "EnvelopeOnly", kind: "place" },
                { name: "Cafe", kind: "meal" },
              ],
            },
          ],
        },
      },
    });
    let theme: string | undefined;
    let names: string[] = [];
    for await (const ev of planItinerarySkeletonOnly(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    })) {
      if (ev.type === "skeleton_day") {
        theme = ev.theme;
        names = (ev.stops ?? []).map((s) => s.name);
      }
    }
    expect(theme).toBe("FromFetch");
    expect(names).toEqual(["Tower", "Market"]);
  });

  it("should_error_when_skeleton_is_stay_only", async () => {
    mockPoolThenSkeleton(stayOnly);
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3, skeleton: stayOnly },
    });

    const events = [];
    for await (const ev of planItinerarySkeletonOnly(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    })) {
      events.push(ev);
    }
    expect(events.some((e) => e.type === "error")).toBe(true);
    expect(events.some((e) => e.type === "skeleton_done")).toBe(false);
  });

  it("should_error_when_make_fails_without_usable_fetch", async () => {
    mockPoolThenSkeleton({ days: [] });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: false,
      outcome: { key: "errors.make_itinerary_failed" },
    });

    const events = [];
    for await (const ev of planItinerarySkeletonOnly(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    })) {
      events.push(ev);
    }
    const err = events.find((e) => e.type === "error");
    expect(err && "key" in err ? err.key : "").toBe("errors.make_itinerary_failed");
  });

  it("should_error_with_fetch_key_when_make_ok_but_fetch_fails", async () => {
    mockPoolThenSkeleton({ days: [] });
    vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3, skeleton: fillableSkeleton },
    });
    vi.spyOn(client, "fetchTripDetails").mockImplementation(async (body) => {
      const fields = (body.fields as string[] | undefined) ?? [];
      if (fields.includes("skeleton")) {
        return { agent: "places-agent", ok: false, outcome: { key: "errors.provider_failed" } };
      }
      return {
        agent: "places-agent",
        ok: true,
        data: {
          trip_id: "t1",
          revision: 2,
          data: { candidates: { places: [{ name: "Tower" }], restaurants: [] } },
        },
      };
    });
    const events = [];
    for await (const ev of planItinerarySkeletonOnly(criteria, {
      locale: "EN",
      providers: ["GOOGLE_MAPS"],
    })) {
      events.push(ev);
    }
    const err = events.find((e) => e.type === "error");
    expect(err && "key" in err ? err.key : "").toBe("play.plan.assistant_fetch_failed");
  });

  it("should_pass_intake_origin_coords_and_not_geocode_hotel_name", async () => {
    const makeSpy = vi.spyOn(client, "makeItinerary").mockResolvedValue({
      agent: "places-agent",
      ok: true,
      data: { trip_id: "t1", revision: 3, skeleton: fillableSkeleton },
    });
    mockPoolThenSkeleton(fillableSkeleton);
    for await (const ev of planItinerarySkeletonOnly(
      {
        ...criteria,
        dailyStart: "Hills Hotel Lisboa",
        originLat: 38.73,
        originLng: -9.14,
      },
      { locale: "EN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error" || ev.type === "skeleton_done") break;
    }
    expect(client.geocode).not.toHaveBeenCalled();
    expect(makeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { name: "Hills Hotel Lisboa", lat: 38.73, lng: -9.14 },
      }),
    );
  });
});
