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

  it("should_return_phases_and_skeleton_when_skeleton_only (TC-T3-101-03)", async () => {
    const email = `trip.t3.${Date.now()}@where2play.place`;
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
              trip_id: "trip-t3-1",
              revision: 3,
              status: "ready",
              phases: [
                { phase: "trip_created", trip_id: "trip-t3-1" },
                { phase: "skeleton_generating", trip_id: "trip-t3-1" },
                { phase: "skeleton_ready", trip_id: "trip-t3-1", revision: 3 },
              ],
              itinerary: {
                skeleton: {
                  days: [
                    {
                      day_index: 1,
                      stops: [
                        { name: "Hotel", kind: "stay" },
                        { name: "Tower", kind: "place" },
                      ],
                    },
                  ],
                },
                filledStops: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/fetch_trip_details")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-t3-1",
              revision: 3,
              data: {
                skeleton: {
                  days: [
                    {
                      day_index: 1,
                      stops: [
                        { name: "Hotel", kind: "stay" },
                        { name: "Tower", kind: "place" },
                      ],
                    },
                  ],
                },
                constraints: {
                  city: "Lisbon",
                  party_size: 2,
                  start_time: "09:00",
                  other: "quiet evenings",
                },
              },
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
          days: 3,
          partySize: 2,
          budget: "mid",
          tripType: "couple",
          pace: "medium",
          transit: "transit_walk",
          locale: "EN",
          originName: "Hills Hotel",
          startTime: "09:00",
          other: "quiet evenings",
          skeleton_only: true,
        },
      }),
    );
    expect(post.status).toBe(200);
    const posted = await readJson<{
      trip_id?: string;
      status?: string;
      phases?: Array<{ phase: string }>;
      skeleton?: { days?: unknown[] };
      need_input?: unknown;
    }>(post);
    expect(posted.trip_id).toBe("trip-t3-1");
    expect(posted.status).toBe("ready");
    expect(posted.need_input).toBeUndefined();
    expect(posted.phases?.map((p) => p.phase)).toEqual(
      expect.arrayContaining(["trip_created", "skeleton_generating", "skeleton_ready"]),
    );
    expect(posted.skeleton?.days?.length).toBeGreaterThanOrEqual(1);
  });

  it("should_pass_through_expand_radius_need_input_when_skeleton_only (TC-T3-104-02)", async () => {
    const email = `trip.expand.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email, "testpass123");

    let seenAnswers: unknown;
    setPlacesAgentFetchForTests(async (input, init) => {
      const url = String(input);
      if (url.includes("/v1/plan_trip")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        seenAnswers = body.answers;
        if (body.answers && typeof body.answers === "object") {
          return new Response(
            JSON.stringify({
              agent: "places-agent",
              ok: true,
              data: {
                trip_id: "trip-expand-1",
                revision: 2,
                status: "ready",
                phases: [
                  { phase: "trip_created", trip_id: "trip-expand-1" },
                  { phase: "skeleton_generating", trip_id: "trip-expand-1" },
                  { phase: "skeleton_ready", trip_id: "trip-expand-1", revision: 2 },
                ],
                itinerary: {
                  skeleton: {
                    days: [{ day_index: 1, stops: [{ name: "Tower", kind: "place" }] }],
                  },
                  filledStops: [],
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
            data: {
              trip_id: "trip-expand-1",
              revision: 1,
              status: "needs_input",
              need_input: {
                questions: [
                  {
                    id: "expand_radius",
                    prompt: "Expand?",
                    options: [
                      { id: "yes", label: "Yes" },
                      { id: "no", label: "No" },
                    ],
                  },
                ],
              },
              phases: [
                { phase: "trip_created", trip_id: "trip-expand-1" },
                { phase: "skeleton_generating", trip_id: "trip-expand-1" },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/v1/fetch_trip_details")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-expand-1",
              revision: 2,
              data: {
                skeleton: {
                  days: [{ day_index: 1, stops: [{ name: "Tower", kind: "place" }] }],
                },
              },
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

    const needPost = await invokeRoute(
      tripRoute,
      authedRequest("/api/plan/trip", {
        method: "POST",
        body: {
          city: "Lisbon",
          startDate: "2026-09-20",
          days: 3,
          partySize: 2,
          budget: "mid",
          tripType: "couple",
          pace: "medium",
          transit: "transit_walk",
          locale: "EN",
          skeleton_only: true,
        },
      }),
    );
    expect(needPost.status).toBe(200);
    const needBody = await readJson<{
      status?: string;
      need_input?: { questions?: Array<{ id: string }> };
    }>(needPost);
    expect(needBody.status).toBe("needs_input");
    expect(needBody.need_input?.questions?.some((q) => q.id === "expand_radius")).toBe(true);

    const affirm = await invokeRoute(
      tripRoute,
      authedRequest("/api/plan/trip", {
        method: "POST",
        body: {
          city: "Lisbon",
          startDate: "2026-09-20",
          days: 3,
          partySize: 2,
          budget: "mid",
          tripType: "couple",
          pace: "medium",
          transit: "transit_walk",
          locale: "EN",
          skeleton_only: true,
          trip_id: "trip-expand-1",
          revision: 1,
          answers: { expand_radius: "yes" },
        },
      }),
    );
    expect(affirm.status).toBe(200);
    expect(seenAnswers).toEqual({ expand_radius: "yes" });
    const affirmed = await readJson<{ status?: string; skeleton?: unknown }>(affirm);
    expect(affirmed.status).toBe("ready");
    expect(affirmed.skeleton).toBeTruthy();
  });
});
