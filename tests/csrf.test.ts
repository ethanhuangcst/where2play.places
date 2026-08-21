import { describe, expect, it, vi } from "vitest";
import { csrfOk } from "../src/auth/csrf";

describe("csrfOk", () => {
  it("should_accept_matching_origin", () => {
    const request = new Request("http://localhost:3030/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost:3030", host: "localhost:3030" },
    });
    expect(csrfOk(request)).toBe(true);
  });

  it("should_reject_cross_origin", () => {
    const request = new Request("http://localhost:3030/api/auth/login", {
      method: "POST",
      headers: { origin: "http://evil.example", host: "localhost:3030" },
    });
    expect(csrfOk(request)).toBe(false);
  });

  it("should_reject_invalid_referer", () => {
    const request = new Request("http://localhost:3030/api/auth/login", {
      method: "POST",
      headers: { referer: "http://evil.example/login", host: "localhost:3030" },
    });
    expect(csrfOk(request)).toBe(false);
  });

  it("should_reject_invalid_referer_url", () => {
    const request = new Request("http://localhost:3030/api/auth/login", {
      method: "POST",
      headers: { referer: "not a url", host: "localhost:3030" },
    });
    expect(csrfOk(request)).toBe(false);
  });

  it("should_accept_lan_dev_origin_when_configured", () => {
    vi.stubEnv("ALLOWED_DEV_ORIGINS", "192.168.1.10");
    const request = new Request("http://192.168.1.10:3030/api/auth/login", {
      method: "POST",
      headers: { origin: "http://192.168.1.10:3030", host: "192.168.1.10:3030" },
    });
    expect(csrfOk(request)).toBe(true);
    vi.unstubAllEnvs();
  });
});
