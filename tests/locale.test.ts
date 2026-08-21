import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as localeRoute } from "../app/api/locale/route";
import { getTestCookie } from "./setup";
import { bffRequest, invokeRoute, readJson } from "./helpers/http-bff";
import { authedRequest, loginTestUser, registerTestUser } from "./helpers/test-user";

describe("POST /api/locale", () => {
  it("should_set_locale_cookie_and_user_locale_when_authenticated", async () => {
    await registerTestUser();
    await loginTestUser();
    const res = await invokeRoute(
      localeRoute,
      authedRequest("/api/locale", { method: "POST", body: { locale: "HK" } }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ locale: string }>(res);
    expect(body.locale).toBe("HK");
    expect(getTestCookie("where2play_locale")).toBe("HK");
  });

  it("should_reject_unauthenticated", async () => {
    const res = await invokeRoute(
      localeRoute,
      bffRequest("/api/locale", { method: "POST", body: { locale: "TW" } }),
    );
    expect(res.status).toBe(401);
  });

  it("should_reject_csrf", async () => {
    const res = await invokeRoute(
      localeRoute,
      new NextRequest("http://localhost:3030/api/locale", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({ locale: "EN" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("should_reject_invalid_locale", async () => {
    await registerTestUser();
    await loginTestUser();
    const res = await invokeRoute(
      localeRoute,
      authedRequest("/api/locale", { method: "POST", body: { locale: "XX" } }),
    );
    expect(res.status).toBe(400);
  });
});
