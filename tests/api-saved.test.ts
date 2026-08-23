import { describe, expect, it } from "vitest";
import { GET as getSaved, POST as postSaved } from "../app/api/saved/route";
import { DELETE as deleteSaved } from "../app/api/saved/[id]/route";
import { GET as getItinerary } from "../app/api/itineraries/[id]/route";
import { prisma } from "../src/db/client";
import { bffRequest, invokeRoute, readJson } from "./helpers/http-bff";
import {
  authedRequest,
  loginTestUser,
  registerTestUser,
  sessionCookieHeader,
} from "./helpers/test-user";
import { NextRequest } from "next/server";
import type { ItineraryDto } from "../src/core/itinerary-types";

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
    const body = await readJson<{ itinerary: ItineraryDto; messages: unknown[] }>(res);
    expect(body.itinerary.destination).toBe("London");
    expect(body.messages).toEqual([]);
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
