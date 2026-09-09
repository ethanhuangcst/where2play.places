import { describe, expect, it } from "vitest";
import { resolveErrorKey } from "../src/i18n/error-key";

describe("resolveErrorKey", () => {
  it("should_map_errors_dot_keys_to_play_errors", () => {
    expect(resolveErrorKey("errors.provider_failed")).toBe("play.errors.provider_failed");
  });

  it("should_return_fallback_when_key_is_not_a_string", () => {
    expect(resolveErrorKey({ error: { key: "errors.validation" } })).toBe(
      "play.errors.provider_failed",
    );
    expect(resolveErrorKey(undefined)).toBe("play.errors.provider_failed");
  });
});
