import { afterEach, describe, expect, it } from "vitest";
import { openaiApiBaseUrl } from "../src/core/openai-config";

describe("openaiApiBaseUrl", () => {
  const prev = process.env.OPENAI_BASE_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = prev;
  });

  it("should_default_to_quanzil_v1", () => {
    delete process.env.OPENAI_BASE_URL;
    expect(openaiApiBaseUrl()).toBe("https://quanzil.com/v1");
  });

  it("should_preserve_explicit_v1_suffix", () => {
    process.env.OPENAI_BASE_URL = "https://happycodeai.com/v1/";
    expect(openaiApiBaseUrl()).toBe("https://happycodeai.com/v1");
  });

  it("should_append_v1_when_only_host_configured", () => {
    process.env.OPENAI_BASE_URL = "https://happycodeai.com";
    expect(openaiApiBaseUrl()).toBe("https://happycodeai.com/v1");
  });

  it("should_keep_custom_path_when_not_host_only", () => {
    process.env.OPENAI_BASE_URL = "https://gateway.example.com/openai/v1";
    expect(openaiApiBaseUrl()).toBe("https://gateway.example.com/openai/v1");
  });
});
