import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as planRoute } from "../app/api/plan/route";
import { GET as planCurrentRoute } from "../app/api/plan/current/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { setArrangeLlmCompleteForTests, setArrangeHostForTests } from "../src/core/plan-arrange-llm";
import { setEnrichArrangeTransitForTests } from "../src/core/plan-enrich-transit";
import { bffRequest, invokeRoute, readJson } from "./helpers/http-bff";
import {
  authedRequest,
  loginTestUser,
  registerTestUser,
} from "./helpers/test-user";

/** Discover + optional agent tools — L2 Quanzil after Mode H host (MVP-3). */
function agentFetchMockModeH() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/v1/plan_itinerary")) {
      return new Response(
        JSON.stringify({ agent: "places-agent", ok: false, error: "unexpected_plan_itinerary" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/discover_places")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const wantsNdjson =
        typeof init?.headers === "object" &&
        init.headers !== null &&
        "Accept" in init.headers &&
        String((init.headers as Record<string, string>).Accept).includes("ndjson");
      if (wantsNdjson) {
        return new Response("", { status: 502 });
      }
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            candidates: {
              places: [
                { name: "Place Day 1" },
                { name: "Place Day 2" },
                { name: "Place Day 3" },
              ],
              restaurants: [{ name: "Rest A" }, { name: "Rest B" }],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/arrange_day")) {
      const reqBody = init?.body ? JSON.parse(String(init.body)) : {};
      if (reqBody.execution === "agent") {
        return new Response(
          JSON.stringify({ agent: "places-agent", ok: false, error: "forbidden_agent_execution" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            execution: "host",
            system_prompt: "system",
            user_prompt: "user",
            output_contract: "JSON",
            candidates_slim: reqBody.candidates ?? { places: [], restaurants: [] },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/v1/enrich_arrange_transit")) {
      const reqBody = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            ...reqBody.day,
            transit_outcome: "heuristic",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
  };
}

function installModeHMocks() {
  setArrangeHostForTests(async () => ({
    system: "host-system",
    user: "host-user",
  }));
  setEnrichArrangeTransitForTests(async (body) => {
    const day = body.day as { day_index?: number; blocks: unknown[] };
    return {
      day_index: day.day_index ?? 1,
      blocks: day.blocks as Array<{
        name: string;
        type: string;
        start_time: string;
        duration_min: number;
        reason: string;
      }>,
      transit_outcome: "heuristic" as const,
    };
  });
  installArrangeLlmMock();
}

function installArrangeLlmMock() {
  let call = 0;
  setArrangeLlmCompleteForTests(async () => {
    call += 1;
    const name = call === 1 ? "Place Day 1" : "Place Day 2";
    return JSON.stringify({
      day_index: call,
      blocks: [
        {
          name,
          type: "attraction",
          start_time: "10:00",
          duration_min: 90,
          reason: "highlight",
        },
      ],
    });
  });
}

describe("POST /api/plan (MVP-3 Mode H)", () => {
  beforeEach(() => {
    setPlacesAgentFetchForTests(null);
    setArrangeLlmCompleteForTests(null);
    setArrangeHostForTests(null);
    setEnrichArrangeTransitForTests(null);
    process.env.PLAN_ARRANGE_STREAM = "0";
  });

  afterEach(() => {
    setArrangeLlmCompleteForTests(null);
    setArrangeHostForTests(null);
    setEnrichArrangeTransitForTests(null);
    setPlacesAgentFetchForTests(null);
    delete process.env.PLAN_ARRANGE_STREAM;
  });

  it("should_return_itinerary_via_mode_h_host_and_quanzil", async () => {
    await registerTestUser();
    await loginTestUser();
    setPlacesAgentFetchForTests(agentFetchMockModeH());
    installModeHMocks();

    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        body: { destination: "Taipei", days: 1, startDate: "2026-08-22", locale: "EN" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      ok: boolean;
      itinerary: { title: string; days: Array<{ slots: unknown[] }>; destination: string };
    }>(res);
    expect(body.ok).toBe(true);
    expect(body.itinerary.destination).toBe("Taipei");
    expect(body.itinerary.days).toHaveLength(1);
    expect(body.itinerary.days[0]!.slots.length).toBeGreaterThan(0);

    const current = await invokeRoute(planCurrentRoute, authedRequest("/api/plan/current"));
    expect(current.status).toBe(200);
    const cur = await readJson<{ itinerary: { destination: string } | null }>(current);
    expect(cur.itinerary?.destination).toBe("Taipei");
  });

  it("should_stream_ndjson_day_by_day_when_accept_ndjson", async () => {
    await registerTestUser();
    await loginTestUser();
    setPlacesAgentFetchForTests(agentFetchMockModeH());
    installModeHMocks();

    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        headers: { Accept: "application/x-ndjson" },
        body: { destination: "Taipei", days: 2, startDate: "2026-08-22", locale: "EN" },
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { type: string; dayIndex?: number; itinerary?: { days: unknown[] } });
    expect(lines.some((l) => l.type === "progress" && l.dayIndex === 1)).toBe(true);
    expect(lines.some((l) => l.type === "progress" && l.dayIndex === 2)).toBe(true);
    expect(lines.at(-1)?.type).toBe("done");
    expect(lines.at(-1)?.itinerary?.days).toHaveLength(2);
  });

  it("should_error_when_discover_fails_without_plan_itinerary_fallback", async () => {
    await registerTestUser();
    await loginTestUser();
    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/discover_places")) {
        return new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/v1/plan_itinerary") || url.includes("/v1/arrange_day")) {
        return new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });
    installModeHMocks();

    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        body: { destination: "Taipei", days: 1, startDate: "2026-08-22", locale: "EN" },
      }),
    );
    expect(res.status).toBe(502);
  });

  it("should_surface_openai_not_configured_error_in_ndjson_stream", async () => {
    await registerTestUser();
    await loginTestUser();
    setPlacesAgentFetchForTests(agentFetchMockModeH());
    setArrangeHostForTests(async () => ({ system: "host-system", user: "host-user" }));
    setEnrichArrangeTransitForTests(null);
    setArrangeLlmCompleteForTests(async () => {
      throw Object.assign(new Error("openai_not_configured"), {
        outcomeKey: "errors.openai_not_configured",
      });
    });

    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        headers: { Accept: "application/x-ndjson" },
        body: { destination: "Taipei", days: 1, startDate: "2026-08-22", locale: "EN" },
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { type: string; key?: string });
    expect(lines.some((l) => l.type === "error" && l.key === "errors.openai_not_configured")).toBe(
      true,
    );
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
    await registerTestUser();
    await loginTestUser();
    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        body: { destination: "", days: 20 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("should_return_502_when_discover_returns_empty_ok_false", async () => {
    await registerTestUser();
    await loginTestUser();
    setPlacesAgentFetchForTests(async () =>
      new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    installModeHMocks();
    const res = await invokeRoute(
      planRoute,
      authedRequest("/api/plan", {
        method: "POST",
        body: { destination: "Taipei", days: 2, startDate: "2026-08-22" },
      }),
    );
    expect(res.status).toBe(502);
  });

  it("should_reject_csrf", async () => {
    await registerTestUser();
    await loginTestUser();
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
    await registerTestUser();
    await loginTestUser();
    const res = await invokeRoute(planCurrentRoute, authedRequest("/api/plan/current"));
    expect(res.status).toBe(200);
    const body = await readJson<{ itinerary: null; criteria: null }>(res);
    expect(body.itinerary).toBeNull();
    expect(body.criteria).toBeNull();
  });
});
