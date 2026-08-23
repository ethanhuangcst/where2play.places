import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as chatRoute } from "../app/api/chat/route";
import { setChatLlmCompleteForTests } from "../src/core/chat-assistant";
import type { ItineraryDto } from "../src/core/itinerary-types";
import { invokeRoute, readJson } from "./helpers/http-bff";
import { authedRequest, loginTestUser, registerTestUser } from "./helpers/test-user";

const itinerary: ItineraryDto = {
  title: "Taipei",
  destination: "Taipei",
  daysCount: 1,
  updatedAt: "2026-08-22T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "D1", title: "City", tags: [] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "Museum",
          summary: "visit",
        },
      ],
    },
  ],
};

describe("POST /api/chat (C-13)", () => {
  beforeEach(async () => {
    setChatLlmCompleteForTests(null);
    await registerTestUser({ email: `chat.${Date.now()}@where2play.place` }).catch(() => undefined);
    const email = `chat.${Date.now()}@where2play.place`;
    await registerTestUser({ email });
    await loginTestUser(email);
  });

  afterEach(() => {
    setChatLlmCompleteForTests(null);
  });

  it("should_return_reply_and_patched_itinerary_without_calling_agent_chat", async () => {
    let sawAgentChat = false;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/v1/chat")) sawAgentChat = true;
      return prevFetch(input, init);
    };

    setChatLlmCompleteForTests(async () =>
      JSON.stringify({
        reply: "Moved lunch earlier.",
        itineraryPatch: {
          days: [
            {
              dayIndex: 1,
              slots: [
                {
                  kind: "place",
                  start: "10:00",
                  end: "11:00",
                  placeKind: "Attraction",
                  name: "Museum",
                  summary: "shorter",
                },
              ],
            },
          ],
        },
      }),
    );

    const res = await invokeRoute(
      chatRoute,
      authedRequest("/api/chat", {
        method: "POST",
        body: {
          messages: [{ role: "user", content: "午餐早一点" }],
          itinerary,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      ok: boolean;
      reply: string;
      itinerary: ItineraryDto;
    }>(res);
    expect(body.ok).toBe(true);
    expect(body.reply).toMatch(/Moved lunch|earlier/i);
    expect(body.itinerary.days[0]?.slots[0]?.kind === "place" && body.itinerary.days[0].slots[0].end).toBe(
      "11:00",
    );
    expect(sawAgentChat).toBe(false);
    globalThis.fetch = prevFetch;
  });

  it("should_stream_ndjson_tokens_then_done", async () => {
    setChatLlmCompleteForTests(async () =>
      JSON.stringify({ reply: "OK", itineraryPatch: {} }),
    );
    const res = await invokeRoute(
      chatRoute,
      authedRequest("/api/chat", {
        method: "POST",
        headers: { Accept: "application/x-ndjson" },
        body: {
          messages: [{ role: "user", content: "hi" }],
          itinerary,
        },
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { type: string; reply?: string });
    expect(lines.some((e) => e.type === "token")).toBe(true);
    expect(lines.some((e) => e.type === "done" && e.reply === "OK")).toBe(true);
  });

  it("should_return_openai_not_configured_when_no_key_and_no_mock", async () => {
    setChatLlmCompleteForTests(null);
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const res = await invokeRoute(
      chatRoute,
      authedRequest("/api/chat", {
        method: "POST",
        body: {
          messages: [{ role: "user", content: "hi" }],
          itinerary,
        },
      }),
    );
    expect(res.status).toBe(503);
    const body = await readJson<{ error: { key: string } }>(res);
    expect(body.error.key).toBe("errors.openai_not_configured");
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });
});
