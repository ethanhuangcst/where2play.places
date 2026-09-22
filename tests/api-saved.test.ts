import { afterEach, describe, expect, it } from "vitest";
import { GET as getSaved, POST as postSaved } from "../app/api/saved/route";
import { DELETE as deleteSaved } from "../app/api/saved/[id]/route";
import { GET as getItinerary } from "../app/api/itineraries/[id]/route";
import { prisma } from "../src/db/client";
import { upsertPlanSessionCache } from "../src/core/plan-session-cache";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { bffRequest, invokeRoute, readJson } from "./helpers/http-bff";
import {
  authedRequest,
  loginTestUser,
  registerTestUser,
  sessionCookieHeader,
} from "./helpers/test-user";
import { NextRequest } from "next/server";
import type { ItineraryDto } from "../src/core/itinerary-types";

afterEach(() => {
  setPlacesAgentFetchForTests(null);
});

const SAMPLE_ITINERARY: ItineraryDto = {
  title: "London 2 days",
  destination: "London",
  daysCount: 2,
  updatedAt: "2026-08-23T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "Day 1", title: "Explore", tags: ["culture"] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "British Museum",
          summary: "Highlights tour",
          photoUrl: "https://example.com/bm.jpg",
          nativeId: "live_123",
        },
      ],
    },
  ],
};

async function setupUser(email: string) {
  await registerTestUser({ email });
  await loginTestUser(email);
}

function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function invokeWithParams(
  handler: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response | undefined>,
  request: NextRequest,
  id: string,
) {
  const response = await handler(request, routeCtx(id));
  if (!response) throw new Error("route returned no response");
  return response;
}

describe("/api/saved", () => {
  it("should_reject_unauthenticated_get", async () => {
    const res = await invokeRoute(getSaved, bffRequest("/api/saved"));
    expect(res.status).toBe(401);
  });

  it("should_save_itinerary_with_empty_messages", async () => {
    await setupUser("saved-a@where2play.place");

    const before = await prisma.itineraryChatMessage.count();
    const res = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{ id: string; savedAt: string }>(res);
    expect(body.id).toBeTruthy();
    expect(body.savedAt).toBeTruthy();

    const after = await prisma.itineraryChatMessage.count();
    expect(after).toBe(before);
  });

  it("should_list_saved_trips", async () => {
    await setupUser("saved-b@where2play.place");
    await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );

    const res = await invokeRoute(getSaved, authedRequest("/api/saved"));
    expect(res.status).toBe(200);
    const body = await readJson<{
      trips: Array<{ id: string; title: string; daysCount: number }>;
    }>(res);
    expect(body.trips.length).toBeGreaterThan(0);
    expect(body.trips[0].title).toBe("London 2 days");
    expect(body.trips[0].daysCount).toBe(2);
  });

  it("should_get_itinerary_detail_for_owner", async () => {
    await setupUser("saved-c@where2play.place");
    const saveRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    const saved = await readJson<{ id: string }>(saveRes);

    const res = await invokeWithParams(
      getItinerary,
      authedRequest(`/api/itineraries/${saved.id}`),
      saved.id,
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ itinerary: ItineraryDto; messages: unknown[]; travelTips?: unknown }>(res);
    expect(body.itinerary.destination).toBe("London");
    expect(body.messages).toEqual([]);
    expect(body.travelTips).toBeUndefined();
  });

  it("should_hydrate_travelTips_from_session_trip_artifacts_when_destination_matches", async () => {
    await setupUser("saved-tips-106@where2play.place");
    const user = await prisma.user.findUnique({ where: { email: "saved-tips-106@where2play.place" } });
    expect(user).toBeTruthy();

    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "London",
        days: 2,
        startDate: "2026-09-20",
        partySize: 2,
        budget: "mid",
        locale: "EN",
        tripId: "trip-saved-106",
        revision: 5,
      },
      SAMPLE_ITINERARY,
    );

    setPlacesAgentFetchForTests(async (input) => {
      if (String(input).includes("/v1/fetch_trip_details")) {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-saved-106",
              revision: 5,
              data: {
                artifacts: {
                  tips: {
                    intro: "London tips",
                    iconic_places: ["British Museum"],
                    transit: "Tube",
                    clothing: "Layers",
                    safety: "Mind the gap",
                    weather: { summary: "Mild" },
                  },
                  visa: {
                    passport: "CHN",
                    destination: "GBR",
                    requirement: "visa_required",
                    description: "Visitor visa required.",
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });

    const saveRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    const saved = await readJson<{ id: string }>(saveRes);

    const res = await invokeWithParams(
      getItinerary,
      authedRequest(`/api/itineraries/${saved.id}`),
      saved.id,
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      itinerary: ItineraryDto;
      travelTips?: { intro?: string; visa?: { destination?: string } };
    }>(res);
    expect(body.travelTips?.intro).toBe("London tips");
    expect(body.travelTips?.visa?.destination).toBe("GBR");
    expect(JSON.stringify(body.itinerary)).not.toContain("visa_required");
  });

  it("should_persist_tripId_and_assistant_thread_messages", async () => {
    await setupUser("saved-25-ac2@where2play.place");
    const dirty = {
      ...SAMPLE_ITINERARY,
      visa: { requirement: "visa_required" },
      tips: { intro: "leak" },
    };
    const messages = [
      { role: "user" as const, content: "Hyatt" },
      { role: "assistant" as const, content: "Skeleton ready" },
      { role: "assistant" as const, content: "Plan complete" },
    ];
    const res = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: dirty,
          messages,
          tripId: "trip-25-ac2",
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{ id: string; updated?: boolean }>(res);
    expect(body.updated).toBe(false);
    const row = await prisma.savedItinerary.findUnique({
      where: { id: body.id },
      include: { messages: { orderBy: { ord: "asc" } } },
    });
    expect(row?.tripId).toBe("trip-25-ac2");
    expect(row?.messages.map((m) => ({ role: m.role, content: m.content }))).toEqual(messages);
    expect(JSON.stringify(row?.snapshot)).not.toContain("visa_required");
    expect(JSON.stringify(row?.snapshot)).not.toContain("leak");
  });

  it("should_upsert_same_tripId_to_one_row_on_second_save", async () => {
    await setupUser("saved-upsert@where2play.place");
    const user = await prisma.user.findUnique({
      where: { email: "saved-upsert@where2play.place" },
    });
    const firstRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: SAMPLE_ITINERARY,
          messages: [{ role: "assistant", content: "first" }],
          tripId: "trip-upsert-same",
        },
      }),
    );
    expect(firstRes.status).toBe(201);
    const first = await readJson<{ id: string; savedAt: string; updated?: boolean }>(firstRes);
    expect(first.updated).toBe(false);

    const secondItinerary: ItineraryDto = {
      ...SAMPLE_ITINERARY,
      title: "London revised",
      daysCount: 3,
    };
    const secondRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: secondItinerary,
          messages: [
            { role: "user", content: "West End" },
            { role: "assistant", content: "second" },
          ],
          tripId: "trip-upsert-same",
        },
      }),
    );
    expect(secondRes.status).toBe(200);
    const second = await readJson<{ id: string; savedAt: string; updated?: boolean }>(secondRes);
    expect(second.id).toBe(first.id);
    expect(second.updated).toBe(true);
    expect(new Date(second.savedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.savedAt).getTime(),
    );

    const count = await prisma.savedItinerary.count({ where: { userId: user!.id } });
    expect(count).toBe(1);
    const row = await prisma.savedItinerary.findUnique({
      where: { id: first.id },
      include: { messages: { orderBy: { ord: "asc" } } },
    });
    expect(row?.title).toBe("London revised");
    expect(row?.daysCount).toBe(3);
    expect(row?.messages.map((m) => m.content)).toEqual(["West End", "second"]);
  });

  it("should_create_two_rows_when_tripId_differs", async () => {
    await setupUser("saved-upsert-diff@where2play.place");
    const user = await prisma.user.findUnique({
      where: { email: "saved-upsert-diff@where2play.place" },
    });
    await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: SAMPLE_ITINERARY,
          messages: [],
          tripId: "trip-a",
        },
      }),
    );
    await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: { ...SAMPLE_ITINERARY, title: "Other" },
          messages: [],
          tripId: "trip-b",
        },
      }),
    );
    const count = await prisma.savedItinerary.count({ where: { userId: user!.id } });
    expect(count).toBe(2);
  });

  it("should_create_two_rows_when_tripId_absent_twice", async () => {
    await setupUser("saved-upsert-null@where2play.place");
    const user = await prisma.user.findUnique({
      where: { email: "saved-upsert-null@where2play.place" },
    });
    await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: { ...SAMPLE_ITINERARY, title: "Again" },
          messages: [],
        },
      }),
    );
    const count = await prisma.savedItinerary.count({ where: { userId: user!.id } });
    expect(count).toBe(2);
  });

  it("should_fill_tripId_from_session_when_body_omits_it", async () => {
    await setupUser("saved-25-session@where2play.place");
    const user = await prisma.user.findUnique({
      where: { email: "saved-25-session@where2play.place" },
    });
    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "London",
        days: 2,
        startDate: "2026-09-20",
        partySize: 2,
        budget: "mid",
        locale: "EN",
        tripId: "trip-from-session",
      },
      SAMPLE_ITINERARY,
    );

    const res = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{ id: string }>(res);
    const row = await prisma.savedItinerary.findUnique({ where: { id: body.id } });
    expect(row?.tripId).toBe("trip-from-session");
  });

  it("should_keep_previous_row_when_different_tripId_saved", async () => {
    await setupUser("saved-25-ac3@where2play.place");
    const firstMessages = [{ role: "assistant" as const, content: "first-save" }];
    const firstRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: SAMPLE_ITINERARY,
          messages: firstMessages,
          tripId: "trip-ac3-v1",
        },
      }),
    );
    const first = await readJson<{ id: string }>(firstRes);

    const secondItinerary: ItineraryDto = {
      ...SAMPLE_ITINERARY,
      title: "London 3 days",
      daysCount: 3,
    };
    await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: secondItinerary,
          messages: [{ role: "assistant", content: "second-save" }],
          tripId: "trip-ac3-v2",
        },
      }),
    );

    const firstRow = await prisma.savedItinerary.findUnique({
      where: { id: first.id },
      include: { messages: { orderBy: { ord: "asc" } } },
    });
    expect(firstRow?.tripId).toBe("trip-ac3-v1");
    expect(firstRow?.title).toBe("London 2 days");
    expect(firstRow?.messages.map((m) => m.content)).toEqual(["first-save"]);
    const count = await prisma.savedItinerary.count({
      where: { userId: firstRow!.userId },
    });
    expect(count).toBe(2);
  });

  it("should_hydrate_travelTips_from_saved_row_tripId_when_session_dest_differs", async () => {
    await setupUser("saved-25-row-tips@where2play.place");
    const user = await prisma.user.findUnique({
      where: { email: "saved-25-row-tips@where2play.place" },
    });

    await upsertPlanSessionCache(
      user!.id,
      {
        destination: "Paris",
        days: 3,
        startDate: "2026-10-01",
        partySize: 2,
        budget: "mid",
        locale: "EN",
        tripId: "trip-paris-session",
        revision: 1,
      },
      { ...SAMPLE_ITINERARY, destination: "Paris", title: "Paris 3 days", daysCount: 3 },
    );

    setPlacesAgentFetchForTests(async (input, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (String(input).includes("/v1/fetch_trip_details") && body.trip_id === "trip-london-saved") {
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-london-saved",
              data: {
                artifacts: {
                  tips: {
                    intro: "London from row tripId",
                    iconic_places: ["British Museum"],
                    transit: "Tube",
                    clothing: "Layers",
                    safety: "OK",
                    weather: { summary: "Mild" },
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });

    const saveRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: {
          itinerary: SAMPLE_ITINERARY,
          messages: [],
          tripId: "trip-london-saved",
        },
      }),
    );
    const saved = await readJson<{ id: string }>(saveRes);

    const res = await invokeWithParams(
      getItinerary,
      authedRequest(`/api/itineraries/${saved.id}`),
      saved.id,
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ travelTips?: { intro?: string } }>(res);
    expect(body.travelTips?.intro).toBe("London from row tripId");
  });

  it("should_return_404_for_other_users_itinerary", async () => {
    await setupUser("owner-d@where2play.place");
    const saveRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    const saved = await readJson<{ id: string }>(saveRes);

    await setupUser("other-d@where2play.place");
    const res = await invokeWithParams(
      getItinerary,
      authedRequest(`/api/itineraries/${saved.id}`),
      saved.id,
    );
    expect(res.status).toBe(404);
  });

  it("should_delete_saved_trip", async () => {
    await setupUser("saved-e@where2play.place");
    const saveRes = await invokeRoute(
      postSaved,
      authedRequest("/api/saved", {
        method: "POST",
        body: { itinerary: SAMPLE_ITINERARY, messages: [] },
      }),
    );
    const saved = await readJson<{ id: string }>(saveRes);

    const delRes = await invokeWithParams(
      deleteSaved,
      authedRequest(`/api/saved/${saved.id}`, { method: "DELETE" }),
      saved.id,
    );
    expect(delRes.status).toBe(200);

    const listAfter = await invokeRoute(getSaved, authedRequest("/api/saved"));
    const afterBody = await readJson<{ trips: Array<{ id: string }> }>(listAfter);
    expect(afterBody.trips.some((t) => t.id === saved.id)).toBe(false);
  });

  it("should_reject_csrf_missing_on_post", async () => {
    await setupUser("saved-f@where2play.place");
    const res = await invokeRoute(
      postSaved,
      new NextRequest("http://localhost:3030/api/saved", {
        method: "POST",
        headers: {
          host: "localhost:3030",
          cookie: sessionCookieHeader() ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({ itinerary: SAMPLE_ITINERARY, messages: [] }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
