import { afterEach, describe, expect, it } from "vitest";
import {
  arrangeDay,
  setPlacesAgentFetchForTests,
  streamV1Ndjson,
} from "../src/places-agent/client";

afterEach(() => {
  setPlacesAgentFetchForTests(null);
  delete process.env.PLACES_AGENT_ARRANGE_TIMEOUT_MS;
});

describe("places-agent arrange timeout key", () => {
  it("should_return_arrange_timeout_when_post_aborts", async () => {
    process.env.PLACES_AGENT_ARRANGE_TIMEOUT_MS = "40";
    setPlacesAgentFetchForTests(async (_url, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const envelope = await arrangeDay({ dayIndex: 1, candidates: { places: [], restaurants: [] } });
    expect(envelope.ok).toBe(false);
    expect(envelope.outcome?.key).toBe("errors.arrange_timeout");
  });

  it("should_yield_arrange_timeout_when_ndjson_stream_aborts", async () => {
    process.env.PLACES_AGENT_ARRANGE_TIMEOUT_MS = "40";
    setPlacesAgentFetchForTests(async (_url, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const events: Array<{ type: string; key?: string }> = [];
    for await (const ev of streamV1Ndjson("arrange_day", { dayIndex: 1 })) {
      events.push(ev as { type: string; key?: string });
    }
    expect(events).toEqual([{ type: "error", key: "errors.arrange_timeout" }]);
  });
});
