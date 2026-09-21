import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as forwardGeocode } from "../app/api/geocode/route";
import { setPlacesAgentFetchForTests } from "../src/places-agent/client";
import { bffRequest, readJson } from "./helpers/http-bff";

describe("POST /api/geocode (forward, CSRF no session)", () => {
  beforeEach(() => {
    setPlacesAgentFetchForTests(null);
  });

  it("should_geocode_without_session_when_csrf_ok", async () => {
    setPlacesAgentFetchForTests(async () =>
      new Response(
        JSON.stringify({
          agent: "places-agent",
          ok: true,
          data: {
            lat: 31.23,
            lng: 121.47,
            crs: "WGS84",
            label: "上海市",
            country: "中国",
            country_code: "CN",
            city: "上海",
            city_en: "Shanghai",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const res = await forwardGeocode(
      bffRequest("/api/geocode", {
        method: "POST",
        body: { query: "上海", locale: "CN" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      ok: boolean;
      city?: string;
      lat?: number;
      lng?: number;
      country_code?: string;
    }>(res);
    expect(body.ok).toBe(true);
    expect(body.city).toBe("上海");
    expect(body.lat).toBe(31.23);
    expect(body.lng).toBe(121.47);
    expect(body.country_code).toBe("CN");
  });

  it("should_reject_csrf", async () => {
    const res = await forwardGeocode(
      new NextRequest("http://localhost:3030/api/geocode", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({ query: "上海" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("should_return_422_when_agent_fails", async () => {
    setPlacesAgentFetchForTests(async () =>
      new Response(JSON.stringify({ agent: "places-agent", ok: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const res = await forwardGeocode(
      bffRequest("/api/geocode", {
        method: "POST",
        body: { query: "zzz-unknown", locale: "EN" },
      }),
    );
    expect(res.status).toBe(422);
  });
});
