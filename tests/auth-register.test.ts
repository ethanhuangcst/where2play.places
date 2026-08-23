import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerRoute } from "../app/api/auth/register/route";
import { bffRequest, readJson } from "./helpers/http-bff";
import { prisma } from "../src/db/client";

describe("POST /api/auth/register", () => {
  it("should_create_user_when_valid", async () => {
    const res = await registerRoute(
      bffRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "New User",
          email: "new.user@where2play.place",
          password: "testpass123",
          confirmPassword: "testpass123",
          defaultLocation: "Tokyo",
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ ok: boolean }>(res);
    expect(body.ok).toBe(true);
  });

  it("should_create_interest_profile_with_optional_interests", async () => {
    const res = await registerRoute(
      bffRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "Interest User",
          email: "interests@where2play.place",
          password: "testpass123",
          confirmPassword: "testpass123",
          interests: ["museum", "park", "bogus"],
        },
      }),
    );
    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({
      where: { email: "interests@where2play.place" },
      include: { interestProfile: true },
    });
    expect(user?.interestProfile).toBeTruthy();
    expect(user?.interestProfile?.interests).toEqual(["museum", "park"]);
  });

  it("should_reject_csrf_when_origin_missing", async () => {
    const res = await registerRoute(
      new NextRequest("http://localhost:3030/api/auth/register", {
        method: "POST",
        headers: { host: "localhost:3030", "content-type": "application/json" },
        body: JSON.stringify({
          name: "X",
          email: "x@where2play.place",
          password: "testpass123",
          confirmPassword: "testpass123",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("should_reject_invalid_body", async () => {
    const res = await registerRoute(
      bffRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "",
          email: "bad",
          password: "short",
          confirmPassword: "short",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { key: string; field?: string } }>(res);
    expect(body.error.field).toBe("name");
  });

  it("should_reject_age_out_of_range", async () => {
    const res = await registerRoute(
      bffRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "Age Test",
          email: "age.test@where2play.place",
          age: 5,
          password: "testpass123",
          confirmPassword: "testpass123",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { field?: string } }>(res);
    expect(body.error.field).toBe("age");
  });

  it("should_reject_password_mismatch", async () => {
    const res = await registerRoute(
      bffRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "Mismatch",
          email: "mismatch@where2play.place",
          password: "testpass123",
          confirmPassword: "testpass999",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { key: string; field?: string } }>(res);
    expect(body.error.key).toBe("errors.password_mismatch");
    expect(body.error.field).toBe("password_confirm");
  });

  it("should_reject_duplicate_email", async () => {
    const body = {
      name: "Dup",
      email: "dup@where2play.place",
      password: "testpass123",
      confirmPassword: "testpass123",
    };
    await registerRoute(bffRequest("/api/auth/register", { method: "POST", body }));
    const res = await registerRoute(bffRequest("/api/auth/register", { method: "POST", body }));
    expect(res.status).toBe(409);
  });
});
