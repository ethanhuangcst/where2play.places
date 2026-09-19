import { describe, expect, it } from "vitest";
import {
  chatDraftStorageKey,
  clearAllChatStorage,
  clearChatDraft,
  loadChatDraft,
  saveChatDraft,
  CHAT_DRAFT_KEY,
} from "../src/chat/local-storage";

describe("local-draft (U-08)", () => {
  it("should_save_and_load_draft_messages", () => {
    const store = new Map<string, string>();
    const fake: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
      key: (i) => [...store.keys()][i] ?? null,
    };
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });

    saveChatDraft([{ role: "user", content: "hello" }]);
    expect(loadChatDraft()).toEqual([{ role: "user", content: "hello" }]);
    expect(store.has(CHAT_DRAFT_KEY)).toBe(true);
    clearAllChatStorage();
    expect(loadChatDraft()).toEqual([]);
  });

  it("should_scope_draft_by_trip_id", () => {
    const store = new Map<string, string>();
    const fake: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
      key: (i) => [...store.keys()][i] ?? null,
    };
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });

    saveChatDraft([{ role: "user", content: "trip-a" }], "trip-a");
    saveChatDraft([{ role: "user", content: "trip-b" }], "trip-b");
    expect(loadChatDraft("trip-a")).toEqual([{ role: "user", content: "trip-a" }]);
    expect(loadChatDraft("trip-b")).toEqual([{ role: "user", content: "trip-b" }]);
    expect(chatDraftStorageKey("trip-a")).toBe(`${CHAT_DRAFT_KEY}.trip-a`);
    clearChatDraft("trip-a");
    expect(loadChatDraft("trip-a")).toEqual([]);
    expect(loadChatDraft("trip-b")).toHaveLength(1);
  });
});
