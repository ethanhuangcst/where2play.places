import { afterEach, describe, expect, it } from "vitest";
import { PATCH as sessionRoute } from "../app/api/plan/session/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { upsertPlanSessionCache } from "../src/core/plan-session-cache";
import { prisma } from "../src/db/client";
import { authedRequest, loginTestUser, registerTestUser } from "./helpers/test-user";
import { invokeRoute, readJson } from "./helpers/http-bff";

afterEach(() => {
  setPlacesAgentFetchForTests(null);
});

describe("PATCH /api/plan/session origin (TC-M21-41-22)", () => {
  it("should_return_422_when_search_places_only_has_far_hits", async () => {
    const email = `origin.nf.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "里斯本",
        days: 4,
        startDate: "2026-10-10",
        locale: "CN",
      },
      { title: "里斯本", destination: "里斯本", daysCount: 4, updatedAt: new Date().toISOString(), days: [] },
    );

    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/geocode")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/search_places")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: [{ name: "Hotel Lisboa", location: { lat: 22.186785, lng: 113.549525 } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ agent: "places-agent", ok: false }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    });

    const res = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "Hills Hotel Lisboa", locale: "CN" },
      }),
    );
    expect(res.status).toBe(422);
    const json = await readJson<{ error?: { key?: string } }>(res);
    expect(json.error?.key).toBe("play.plan.intake_origin_not_found");
  });

  it("should_store_origin_coords_when_search_hits_in_city", async () => {
    const email = `origin.hit.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");
    const user = await prisma.user.findUnique({ where: { email } });
    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "里斯本",
        days: 4,
        startDate: "2026-10-10",
        locale: "CN",
      },
      { title: "里斯本", destination: "里斯本", daysCount: 4, updatedAt: new Date().toISOString(), days: [] },
    );

    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/geocode")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/search_places")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: [{ name: "Hills Hotel Lisboa", location: { lat: 38.73, lng: -9.14 } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 500 });
    });

    const res = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "Hills Hotel Lisboa", locale: "CN" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await readJson<{ originLat?: number; originLng?: number }>(res);
    expect(json.originLat).toBeCloseTo(38.73);
    expect(json.originLng).toBeCloseTo(-9.14);
  });

  it("should_return_422_when_search_places_fails (S6A no degraded)", async () => {
    const email = `origin.fail.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");
    const user = await prisma.user.findUnique({ where: { email } });
    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "里斯本",
        days: 4,
        startDate: "2026-10-10",
        locale: "CN",
      },
      { title: "里斯本", destination: "里斯本", daysCount: 4, updatedAt: new Date().toISOString(), days: [] },
    );

    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/geocode")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/search_places")) {
        return new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 500 });
    });

    const res = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "湖滨凯悦", locale: "CN" },
      }),
    );
    expect(res.status).toBe(422);
    const json = await readJson<{ error?: { key?: string } }>(res);
    expect(json.error?.key).toBe("play.plan.intake_origin_not_found");
  });

  it("should_skip_empty_origin_and_store_destination_coords (S7)", async () => {
    const email = `origin.skip.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");
    const user = await prisma.user.findUnique({ where: { email } });
    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "里斯本",
        days: 4,
        startDate: "2026-10-10",
        locale: "CN",
        originLat: 1,
        originLng: 2,
      },
      { title: "里斯本", destination: "里斯本", daysCount: 4, updatedAt: new Date().toISOString(), days: [] },
    );

    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/geocode")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 500 });
    });

    const res = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "   ", locale: "CN" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await readJson<{ originLat?: number; originLng?: number }>(res);
    expect(json.originLat).toBeCloseTo(38.7223);
    expect(json.originLng).toBeCloseTo(-9.1393);
  });

  it("should_return_candidates_without_advancing_when_name_mismatches (S7)", async () => {
    const email = `origin.cand.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");
    const user = await prisma.user.findUnique({ where: { email } });
    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "里斯本",
        days: 4,
        startDate: "2026-10-10",
        locale: "CN",
      },
      { title: "里斯本", destination: "里斯本", daysCount: 4, updatedAt: new Date().toISOString(), days: [] },
    );

    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/geocode")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/search_places")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: [{ name: "Hyatt Regency Lisbon", location: { lat: 38.6985, lng: -9.1867 } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 500 });
    });

    const res = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "湖滨凯悦", locale: "CN" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await readJson<{
      stay_on_step?: boolean;
      origin_candidates?: Array<{ name: string }>;
    }>(res);
    expect(json.stay_on_step).toBe(true);
    expect(json.origin_candidates?.[0]?.name).toBe("Hyatt Regency Lisbon");

    const pick = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "__origin_pick__:0", locale: "CN" },
      }),
    );
    expect(pick.status).toBe(200);
    const picked = await readJson<{
      originLat?: number;
      originLng?: number;
      origin_name?: string;
    }>(pick);
    expect(picked.originLat).toBeCloseTo(38.6985);
    expect(picked.originLng).toBeCloseTo(-9.1867);
    expect(picked.origin_name).toBe("Hyatt Regency Lisbon");

    const cached = await prisma.planSessionCache.findUnique({ where: { userId: user!.id } });
    const criteria = cached?.criteriaJson as { dailyStart?: string };
    expect(criteria.dailyStart).toBe("Hyatt Regency Lisbon");
  });

  it("should_search_from_patch_destination_when_cache_empty", async () => {
    const email = `origin.destbody.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();

    let searchBody = "";
    setPlacesAgentFetchForTests(async (input, init) => {
      const url = String(input);
      if (url.includes("/v1/geocode")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: { lat: 38.7223, lng: -9.1393, crs: "WGS84" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/search_places")) {
        searchBody = typeof init?.body === "string" ? init.body : "";
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: [
              { name: "Hyatt Regency Lisbon", location: { lat: 38.6985, lng: -9.1867 } },
              { name: "Grand Hyatt Lisbon", location: { lat: 38.71, lng: -9.15 } },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 500 });
    });

    const res = await invokeRoute(
      sessionRoute,
      authedRequest("/api/plan/session", {
        method: "PATCH",
        body: { step: "b", value: "凯悦", locale: "CN", destination: "里斯本" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await readJson<{
      stay_on_step?: boolean;
      origin_candidates?: Array<{ name: string }>;
    }>(res);
    expect(json.stay_on_step).toBe(true);
    expect(json.origin_candidates?.map((c) => c.name)).toEqual([
      "Hyatt Regency Lisbon",
      "Grand Hyatt Lisbon",
    ]);
    const parsed = JSON.parse(searchBody) as {
      query?: string;
      providers?: string[];
      bias_radius_m?: number;
    };
    expect(parsed.query?.toLowerCase()).toContain("hyatt");
    expect(parsed.providers).toBeUndefined();
    expect(parsed.bias_radius_m).toBe(50_000);
  });
});
