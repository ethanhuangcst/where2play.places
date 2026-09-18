import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as planRoute } from "../app/api/plan/route";
import { GET as planCurrentRoute } from "../app/api/plan/current/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { bffRequest, invokeRoute, readJson } from "./helpers/http-bff";
import {
  authedRequest,
  loginTestUser,
  registerTestUser,
  TEST_USER,
} from "./helpers/test-user";
import { prisma } from "../src/db/client";

function agentFetchMockSkeletonPipeline() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/v1/discover_places")) {
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            candidates: { places: [{ name: "Tower" }], restaurants: [] },
            trip_id: "trip-cache-1",
            revision: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/make_itinerary")) {
      return new Response(
        JSON.stringify({
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
            trip_id: "trip-cache-1",
            revision: 2,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/travel_tips")) {
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: { trip_id: "trip-cache-1", revision: 3 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/fetch_trip_details")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const fields: string[] = body.fields ?? [];
      if (fields.includes("artifacts")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-cache-1",
              revision: 3,
              data: { artifacts: { tips: { intro: "Hi", iconic_places: ["Tower"] } } },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (fields.includes("skeleton")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-cache-1",
              revision: 4,
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
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: { trip_id: "trip-cache-1", revision: 4, data: {} },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/plan_next_stop")) {
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
            slot: { start: "09:00", end: "09:00" },
            legs: [],
            trip_id: "trip-cache-1",
            revision: 5,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
  };
}

describe("POST /api/plan (skeleton pipeline)", () => {
  beforeEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  afterEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  it("should_reject_unauthenticated", async () => {
    const res = await invokeRoute(
      planRoute,
      bffRequest("/api/plan", {
        method: "POST",
        body: { destination: "Taipei", days: 1, startDate: "2026-08-22" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("should_reject_validation_errors", async () => {
    const email = `plan-val.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email);
    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        body: { destination: "", days: 20 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("should_reject_csrf", async () => {
    const email = `plan-csrf.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email);
    const res = await invokeRoute(
      planRoute,
      new NextRequest("http://localhost:3030/api/plan", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({ destination: "Taipei", days: 1, startDate: "2026-08-22" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/plan/current", () => {
  it("should_return_null_when_no_cache", async () => {
    const email = `plan-cur.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email);
    const res = await invokeRoute(planCurrentRoute, authedRequest("/api/plan/current"));
    expect(res.status).toBe(200);
    const body = await readJson<{ itinerary: null; criteria: null }>(res);
    expect(body.itinerary).toBeNull();
    expect(body.criteria).toBeNull();
  });
});

describe("PlanSessionCache trip ledger", () => {
  beforeEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  afterEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  it("should_persist_trip_id_in_cache_and_refresh_on_current", async () => {
    const email = `plan-ledger.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email);
    setPlacesAgentFetchForTests(agentFetchMockSkeletonPipeline());

    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        headers: { Accept: "application/x-ndjson" },
        body: { destination: "Lisbon", days: 1, startDate: "2026-10-10", locale: "EN" },
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; key?: string });
    expect(lines.some((l) => l.type === "ledger")).toBe(true);
    expect(lines.some((l) => l.type === "error")).toBe(false);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    const row = await prisma.planSessionCache.findUnique({ where: { userId: user!.id } });
    expect(row).toBeTruthy();
    const cachedCriteria = row!.criteriaJson as { tripId?: string; revision?: number };
    expect(cachedCriteria.tripId).toBe("trip-cache-1");
    expect(typeof cachedCriteria.revision).toBe("number");

    const current = await invokeRoute(planCurrentRoute, authedRequest("/api/plan/current"));
    expect(current.status).toBe(200);
    const body = await readJson<{
      criteria: { tripId?: string; revision?: number } | null;
      itinerary: { days: Array<{ dayIndex: number }> } | null;
    }>(current);
    expect(body.criteria?.tripId).toBe("trip-cache-1");
    expect(body.itinerary?.days.length).toBeGreaterThan(0);
  });
});
