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
});
