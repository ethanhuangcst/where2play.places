/**
 * @vitest-environment jsdom
 * Session-scoped refine draft (2play-refine-thread).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_SESSION_DRAFT_KEY,
  clearSessionChatDraft,
  loadSessionChatDraft,
  saveSessionChatDraft,
} from "@/src/chat/local-storage";

describe("session chat draft", () => {
  afterEach(() => {
    localStorage.removeItem(CHAT_SESSION_DRAFT_KEY);
  });

  it("should_append_only_via_saveSessionChatDraft", () => {
    saveSessionChatDraft([{ role: "user", content: "第三天改为室内" }]);
    saveSessionChatDraft([
      { role: "user", content: "第三天改为室内" },
      { role: "assistant", content: "好的，正在调整。" },
    ]);
    expect(loadSessionChatDraft()).toEqual([
      { role: "user", content: "第三天改为室内" },
      { role: "assistant", content: "好的，正在调整。" },
    ]);
  });

  it("should_clear_session_draft_when_new_plan_starts", () => {
    saveSessionChatDraft([{ role: "user", content: "第二天上午不去海昌海洋公园" }]);
    clearSessionChatDraft();
    expect(loadSessionChatDraft()).toEqual([]);
  });
});
