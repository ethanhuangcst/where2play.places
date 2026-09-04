import { describe, expect, it } from "vitest";
import { resolveChatLlmConfig } from "../src/core/llm-chat-config";

describe("resolveChatLlmConfig", () => {
  it("should_prefer_qwen_when_QWEN_API_KEY_is_set", () => {
    const cfg = resolveChatLlmConfig({
      QWEN_API_KEY: "sk-qwen",
      QWEN_BASE_URL: "https://example.com/compatible-mode/v1",
      QWEN_CHAT_MODEL: "qwen-plus",
      OPENAI_API_KEY: "sk-old",
    });
    expect(cfg?.provider).toBe("qwen");
    expect(cfg?.model).toBe("qwen-plus");
  });

  it("should_fall_back_to_openai_cn_when_qwen_key_empty", () => {
    const cfg = resolveChatLlmConfig({
      OPENAI_API_KEY: "sk-old",
      OPENAI_BASE_URL: "https://legacy.example/v1",
    });
    expect(cfg?.provider).toBe("openai_cn");
  });
});
