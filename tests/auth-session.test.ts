import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as logoutRoute } from "../app/api/auth/logout/route";
import { GET as sessionRoute } from "../app/api/auth/session/route";
import { readJson } from "./helpers/http-bff";
import {
  authedRequest,
  loginTestUser,
  registerTestUser,
  sessionCookieHeader,
  TEST_USER,
} from "./helpers/test-user";

describe("POST /api/auth/logout", () => {
  it("should_clear_session", async () => {
    await registerTestUser();
    await loginTestUser();
    expect(sessionCookieHeader()).toBeDefined();

    const res = await logoutRoute(authedRequest("/api/auth/logout", { method: "POST" }));
    expect(res.status).toBe(200);

    const session = await sessionRoute();
    const body = await readJson<{ name: string | null }>(session);
    expect(body.name).toBeNull();
  });

  it("should_reject_csrf", async () => {
    const res = await logoutRoute(
      new NextRequest("http://localhost:3030/api/auth/logout", {
        method: "POST",
        headers: { host: "localhost:3030" },
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/auth/session", () => {
  it("should_return_user_when_authenticated", async () => {
    await registerTestUser();
    await loginTestUser();
    const res = await sessionRoute();
    expect(res.status).toBe(200);
    const body = await readJson<{ email: string; name: string }>(res);
    expect(body.email).toBe(TEST_USER.email);
    expect(body.name).toBe(TEST_USER.name);
  });

  it("should_return_null_name_when_unauthenticated", async () => {
    const res = await sessionRoute();
    const body = await readJson<{ name: string | null }>(res);
    expect(body.name).toBeNull();
  });
});
