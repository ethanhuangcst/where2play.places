import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as reverseGeocode } from "../app/api/geocode/reverse/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { bffRequest, readJson } from "./helpers/http-bff";

describe("POST /api/geocode/reverse", () => {
  beforeEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  it("should_return_label_when_agent_ok", async () => {
    setPlacesAgentFetchForTests(async () =>
      new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            lat: 31.2,
            lng: 121.5,
            crs: "WGS84",
            label: "上海市黄浦区南京东路",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const res = await reverseGeocode(
      bffRequest("/api/geocode/reverse", {
        method: "POST",
        body: { lat: 31.2, lng: 121.5, locale: "CN" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ label: string }>(res);
    expect(body.label).toBe("上海市");
  });

  it("should_return_502_when_agent_fails", async () => {
    setPlacesAgentFetchForTests(async () =>
      new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const res = await reverseGeocode(
      bffRequest("/api/geocode/reverse", {
        method: "POST",
        body: { lat: 22.3, lng: 114.1 },
      }),
    );
    expect(res.status).toBe(502);
  });

  it("should_reject_csrf", async () => {
    const res = await reverseGeocode(
      new NextRequest("http://localhost:3030/api/geocode/reverse", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({ lat: 22.3, lng: 114.1 }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("should_reject_invalid_body", async () => {
    const res = await reverseGeocode(
      bffRequest("/api/geocode/reverse", {
        method: "POST",
        body: { lat: 999, lng: 114.1 },
      }),
    );
    expect(res.status).toBe(400);
  });
});
