import { afterEach, describe, expect, it } from "vitest";
import { POST as tripRoute } from "../app/api/plan/trip/route";
import { GET as currentRoute } from "../app/api/plan/current/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { prisma } from "../src/db/client";
import { authedRequest, loginTestUser, registerTestUser } from "./helpers/test-user";
import { invokeRoute, readJson } from "./helpers/http-bff";

afterEach(() => {
  setPlacesAgentFetchForTests(null);
});

describe("POST /api/plan/trip session cache (2play-plan-90a T1)", () => {
  it("should_upsert_takeoff_fields_and_trip_id_when_plan_trip_succeeds", async () => {
    const email = `trip.session.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");

    setPlacesAgentFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes("/v1/plan_trip")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-lisbon-1",
              revision: 2,
              status: "needs_input",
              need_input: { questions: [{ id: "hotel", prompt: "Hotel?" }] },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    const post = await invokeRoute(
      tripRoute,
      authedRequest("/api/plan/trip", {
        method: "POST",
        body: {
          city: "Lisbon",
          startDate: "2026-09-20",
          days: 4,
          partySize: 2,
          budget: "mid",
          tripType: "couple",
          pace: "medium",
          transit: "transit_walk",
          locale: "EN",
        },
      }),
    );
    expect(post.status).toBe(200);
    const posted = await readJson<{ trip_id?: string }>(post);
    expect(posted.trip_id).toBe("trip-lisbon-1");

    const current = await invokeRoute(currentRoute, authedRequest("/api/plan/current"));
    expect(current.status).toBe(200);
    const json = await readJson<{ criteria?: Record<string, unknown> }>(current);
    expect(json.criteria).toMatchObject({
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "mid",
      tripType: "couple",
      pace: "medium",
      transport: "transit_walk",
      locale: "EN",
      tripId: "trip-lisbon-1",
      revision: 2,
    });

    const user = await prisma.user.findUnique({ where: { email } });
    const row = await prisma.planSessionCache.findUnique({ where: { userId: user!.id } });
    expect(row).toBeTruthy();
  });
});
