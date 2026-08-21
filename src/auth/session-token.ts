import { createHmac, timingSafeEqual } from "node:crypto";
import { COOKIE, LOCALE_COOKIE } from "./cookie-names";

export { COOKIE, LOCALE_COOKIE };

export type SessionPayload = {
  userId: string;
  email: string;
};

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required");
  }
  // Empty SESSION_SECRET= in .env.local overrides shell env (Next.js). Dev/E2E fallback only.
  return "dev-insecure-session-secret-change-me";
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}
