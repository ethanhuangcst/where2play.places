import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as chatRoute } from "../app/api/chat/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import type { ItineraryDto } from "../src/core/itinerary-types";
import { invokeRoute, readJson } from "./helpers/http-bff";
import { authedRequest, loginTestUser, registerTestUser } from "./helpers/test-user";

const itinerary: ItineraryDto = {
  title: "杭州",
  destination: "杭州",
  daysCount: 1,
  updatedAt: "2026-08-22T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "D1", title: "西湖", tags: [] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "苏堤",
          summary: "walk",
        },
        {
          kind: "place",
          start: "13:00",
          end: "14:00",
          placeKind: "Attraction",
          name: "雷峰塔",
          summary: "visit",
        },
      ],
    },
  ],
};

describe("POST /api/chat (MVP-T9 agent refine)", () => {
  beforeEach(async () => {
    const email = `chat-api.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email);
    setPlacesAgentFetchForTests(async (input, init) => {
      const url = String(input);
      if (url.includes("/v1/plan_trip")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        expect(body.refine?.instruction).toBeTruthy();
        expect(body.trip_id).toBe("trip-refine-1");
        return new Response(
          JSON.stringify({
            agent: "places-agent",
            ok: true,
            data: {
              trip_id: "trip-refine-1",
              revision: 9,
              status: "ready",
              reply: "已删除雷峰塔。",
              itinerary: {
                skeleton: {
                  days: [
                    {
                      day_index: 1,
                      day_theme: "西湖",
                      stops: [
                        { name: "苏堤", kind: "attraction" },
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
      return new Response(JSON.stringify({ agent: "places-agent", ok: false }), { status: 502 });
    });
  });

  afterEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  it("should_forward_refine_to_agent_and_return_merged_itinerary", async () => {
    const res = await invokeRoute(
      chatRoute,
      authedRequest("/api/chat", {
        method: "POST",
        body: {
          messages: [{ role: "user", content: "删掉雷峰塔" }],
          itinerary,
          trip_id: "trip-refine-1",
          revision: 8,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      ok: boolean;
      reply: string;
      itinerary: ItineraryDto;
      revision: number;
    }>(res);
    expect(body.ok).toBe(true);
    expect(body.reply).toBe("已删除雷峰塔。");
    expect(body.revision).toBe(9);
    expect(body.itinerary.days[0]?.slots.some((s) => s.kind === "place" && s.name === "雷峰塔")).toBe(
      false,
    );
    expect(body.itinerary.days[0]?.slots.some((s) => s.kind === "place" && s.name === "苏堤")).toBe(
      true,
    );
  });
});
