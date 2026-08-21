import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginRoute } from "../app/api/auth/login/route";
import { bffRequest, readJson } from "./helpers/http-bff";
import { getTestCookie } from "./setup";
import { registerTestUser, TEST_USER } from "./helpers/test-user";
import { POST as registerRoute } from "../app/api/auth/register/route";

describe("POST /api/auth/login", () => {
  it("should_login_with_valid_credentials", async () => {
    await registerTestUser();
    const res = await loginRoute(
      bffRequest("/api/auth/login", {
        method: "POST",
        body: { email: TEST_USER.email, password: TEST_USER.password },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ ok: boolean; name: string }>(res);
    expect(body.ok).toBe(true);
    expect(body.name).toBe(TEST_USER.name);
    expect(getTestCookie("where2play_session")).toBeTruthy();
  });

  it("should_reject_invalid_password", async () => {
    await registerTestUser();
    const res = await loginRoute(
      bffRequest("/api/auth/login", {
        method: "POST",
        body: { email: TEST_USER.email, password: "wrong-password" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("should_set_locale_cookie_from_user_profile_on_login", async () => {
    const email = "locale.login@where2play.place";
    const res = await registerRoute(
      bffRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "Locale Login",
          email,
          password: TEST_USER.password,
          confirmPassword: TEST_USER.password,
          locale: "CN",
        },
      }),
    );
    expect(res.status).toBe(200);
    await readJson(res);

    const loginRes = await loginRoute(
      bffRequest("/api/auth/login", {
        method: "POST",
        body: { email, password: TEST_USER.password },
      }),
    );
    expect(loginRes.status).toBe(200);
    expect(getTestCookie("where2play_locale")).toBe("CN");
  });

  it("should_reject_csrf", async () => {
    const res = await loginRoute(
      new NextRequest("http://localhost:3030/api/auth/login", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c", password: "x" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
