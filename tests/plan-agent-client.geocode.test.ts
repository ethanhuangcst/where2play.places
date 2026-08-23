import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode, setPlacesAgentFetchForTests } from "../src/places-agent/client";

afterEach(() => {
  setPlacesAgentFetchForTests(null);
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("client.geocode (forward geocode: name → coordinates)", () => {
  it("should_return_coordinates_when_agent_succeeds", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        agent: "places-agent",
        ok: true,
        data: { lat: 38.7304, lng: -9.1405, crs: "WGS84", label: "Hills Hotel Lisboa" },
      }),
    );
    setPlacesAgentFetchForTests(fetchFn as unknown as typeof fetch);

    const envelope = await geocode({ query: "Hills Hotel Lisboa", locale: "CN" });

    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual({
      lat: 38.7304,
      lng: -9.1405,
      crs: "WGS84",
      label: "Hills Hotel Lisboa",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit][];
    expect(calls.length).toBe(1);
    const url = String(calls[0][0]);
    expect(url).toContain("/v1/geocode");
    const init = calls[0][1];
    const body = JSON.parse(init.body as string);
    expect(body.query).toBe("Hills Hotel Lisboa");
    expect(body.locale).toBe("CN");
  });

  it("should_return_null_data_when_agent_fails", async () => {
    setPlacesAgentFetchForTests(async () =>
      jsonResponse({ agent: "places-agent", ok: false, outcome: { key: "errors.provider_failed" } }),
    );

    const envelope = await geocode({ query: "Nonexistent Place", locale: "EN" });

    expect(envelope.ok).toBe(false);
    expect(envelope.data).toBeUndefined();
    expect(envelope.outcome?.key).toBe("errors.provider_failed");
  });

  it("should_return_null_data_when_network_throws", async () => {
    setPlacesAgentFetchForTests(async () => {
      throw new Error("network error");
    });

    const envelope = await geocode({ query: "Some Hotel", locale: "EN" });

    expect(envelope.ok).toBe(false);
    expect(envelope.data).toBeUndefined();
  });
});
