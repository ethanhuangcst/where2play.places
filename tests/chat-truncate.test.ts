import { describe, expect, it } from "vitest";
import { truncateChatMessages, type ChatMessage } from "../src/core/chat-truncate";

describe("chat-truncate (U-07)", () => {
  it("should_keep_tail_when_over_max_chars", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "a".repeat(100) },
      { role: "assistant", content: "b".repeat(100) },
      { role: "user", content: "keep-me" },
    ];
    const out = truncateChatMessages(messages, 50);
    expect(out.some((m) => m.content === "keep-me")).toBe(true);
    const total = out.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(50);
  });

  it("should_preserve_system_divider_then_tail", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "old1" },
      { role: "system", content: "--- replan ---" },
      { role: "user", content: "after" },
      { role: "assistant", content: "ok" },
    ];
    const out = truncateChatMessages(messages, 10_000);
    const sysIdx = out.findIndex((m) => m.role === "system");
    expect(sysIdx).toBeGreaterThanOrEqual(0);
    expect(out.slice(sysIdx).some((m) => m.content === "after")).toBe(true);
  });
});
