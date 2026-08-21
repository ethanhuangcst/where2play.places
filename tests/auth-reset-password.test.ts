import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as resetRoute } from "../app/api/auth/reset-password/route";
import { getMailOutbox } from "../src/auth/mail";
import { bffRequest, readJson } from "./helpers/http-bff";
import { registerTestUser, TEST_USER } from "./helpers/test-user";

describe("POST /api/auth/reset-password", () => {
  it("should_enqueue_reset_email_for_existing_user", async () => {
    await registerTestUser();
    const res = await resetRoute(
      bffRequest("/api/auth/reset-password", {
        method: "POST",
        body: { email: TEST_USER.email, locale: "EN" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ ok: boolean }>(res);
    expect(body.ok).toBe(true);
    expect(getMailOutbox().length).toBe(1);
    expect(getMailOutbox()[0]?.to).toBe(TEST_USER.email);
  });

  it("should_succeed_silently_for_unknown_email", async () => {
    const res = await resetRoute(
      bffRequest("/api/auth/reset-password", {
        method: "POST",
        body: { email: "missing@where2play.place", locale: "EN" },
      }),
    );
    expect(res.status).toBe(200);
    expect(getMailOutbox().length).toBe(0);
  });

  it("should_reject_csrf", async () => {
    const res = await resetRoute(
      new NextRequest("http://localhost:3030/api/auth/reset-password", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.c" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
