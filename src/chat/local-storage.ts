/** Clears browser chat drafts for where2play (`w2p.chat.*`). */
export const CHAT_PREFIX = "w2p.chat.";
export const CHAT_DRAFT_KEY = "w2p.chat.draft";
/** Append-only refine transcript for the current browser session (chat-02). */
export const CHAT_SESSION_DRAFT_KEY = `${CHAT_DRAFT_KEY}.session`;
const CHAT_KEY_RE = /^w2p\.chat\./;

/** Per-trip refine transcript (legacy); prefer session draft for refine thread. */
export function chatDraftStorageKey(tripId?: string): string {
  const id = tripId?.trim();
  return id ? `${CHAT_DRAFT_KEY}.${id}` : CHAT_DRAFT_KEY;
}

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

export function clearChatDraft(tripId?: string): void {
  const store = storage();
  if (!store) return;
  store.removeItem(chatDraftStorageKey(tripId));
}

export function loadChatDraft(tripId?: string): ChatDraftMessage[] {
  const store = storage();
  if (!store) return [];
  return parseDraftMessages(store.getItem(chatDraftStorageKey(tripId)));
}

export function saveChatDraft(messages: ChatDraftMessage[], tripId?: string): void {
  const store = storage();
  if (!store) return;
  store.setItem(chatDraftStorageKey(tripId), JSON.stringify(messages));
}

function parseDraftMessages(raw: string | null): ChatDraftMessage[] {
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

export function loadSessionChatDraft(): ChatDraftMessage[] {
  const store = storage();
  if (!store) return [];
  return parseDraftMessages(store.getItem(CHAT_SESSION_DRAFT_KEY));
}

export function saveSessionChatDraft(messages: ChatDraftMessage[]): void {
  const store = storage();
  if (!store) return;
  store.setItem(CHAT_SESSION_DRAFT_KEY, JSON.stringify(messages));
}

export function clearSessionChatDraft(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(CHAT_SESSION_DRAFT_KEY);
}
