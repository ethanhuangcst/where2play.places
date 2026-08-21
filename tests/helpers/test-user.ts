import { expect } from "vitest";
import { POST as registerRoute } from "../../app/api/auth/register/route";
import { POST as loginRoute } from "../../app/api/auth/login/route";
import { NextRequest } from "next/server";
import { bffRequest, readJson } from "./http-bff";
import { getTestCookie } from "../setup";

export const TEST_USER = {
  name: "Contract Test",
  email: "contract.test@where2play.place",
  password: "testpass123",
  defaultLocation: "Central, Hong Kong",
};

export async function registerTestUser(
  overrides: Partial<typeof TEST_USER> & { interests?: string[] } = {},
): Promise<{ email: string; password: string }> {
  const user = { ...TEST_USER, ...overrides };
  const res = await registerRoute(
    bffRequest("/api/auth/register", {
      method: "POST",
      body: {
        name: user.name,
        email: user.email,
        password: user.password,
        confirmPassword: user.password,
        defaultLocation: user.defaultLocation,
        interests: overrides.interests,
      },
    }),
  );
  expect(res.status).toBe(200);
  await readJson(res);
  return { email: user.email, password: user.password };
}

export async function loginTestUser(
  email = TEST_USER.email,
  password = TEST_USER.password,
): Promise<void> {
  const res = await loginRoute(
    bffRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  );
  expect(res.status).toBe(200);
  await readJson(res);
}

export function sessionCookieHeader(): string | undefined {
  const value = getTestCookie("where2play_session");
  return value ? `where2play_session=${value}` : undefined;
}

export function authedRequest(
  path: string,
  init: Parameters<typeof bffRequest>[1] = {},
): NextRequest {
  const cookie = sessionCookieHeader();
  if (!cookie) {
    throw new Error("session cookie missing — call loginTestUser() first");
  }
  return bffRequest(path, { ...init, cookie });
}
