import { execSync } from "node:child_process";
import { beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "../src/db/client";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

export function clearTestCookies() {
  cookieStore.clear();
}

export function getTestCookie(name: string): string | undefined {
  return cookieStore.get(name);
}

async function resetDb() {
  await prisma.planSessionCache.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.interestProfile.deleteMany();
  await prisma.user.deleteMany();
}

execSync("npx prisma migrate deploy", {
  stdio: "pipe",
  env: process.env,
});

beforeEach(async () => {
  clearTestCookies();
  await resetDb();
  const { clearMailOutbox } = await import("../src/auth/mail");
  clearMailOutbox();
});
