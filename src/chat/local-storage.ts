/** Clears browser chat drafts for where2play (`w2p.chat.*`). */
export const CHAT_PREFIX = "w2p.chat.";
export const CHAT_DRAFT_KEY = "w2p.chat.draft";
const CHAT_KEY_RE = /^w2p\.chat\./;

export type ChatDraftMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function storage(): Storage | null {
  if (typeof globalThis === "undefined") return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function clearAllChatStorage(): void {
  const store = storage();
  if (!store) return;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && CHAT_KEY_RE.test(k)) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
}

export function loadChatDraft(): ChatDraftMessage[] {
  const store = storage();
  if (!store) return [];
  const raw = store.getItem(CHAT_DRAFT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is ChatDraftMessage =>
          Boolean(m) &&
          typeof m === "object" &&
          typeof (m as ChatDraftMessage).content === "string" &&
          ["user", "assistant", "system"].includes((m as ChatDraftMessage).role),
      )
      .map((m) => ({ role: m.role, content: m.content }));
  } catch {
    return [];
  }
}

export function saveChatDraft(messages: ChatDraftMessage[]): void {
  const store = storage();
  if (!store) return;
  store.setItem(CHAT_DRAFT_KEY, JSON.stringify(messages));
}
