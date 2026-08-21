import { describe, expect, it } from "vitest";
import { encodeSession, decodeSession } from "@/src/auth/session-token";

describe("session-token", () => {
  it("should_return_null_for_invalid_token", () => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-bytes-long!!";
    expect(decodeSession("bad.token")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });

  it("should_roundtrip_valid_session", () => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-bytes-long!!";
    const token = encodeSession({ userId: "u1", email: "a@b.c" });
    expect(decodeSession(token)).toEqual({ userId: "u1", email: "a@b.c" });
  });
});
