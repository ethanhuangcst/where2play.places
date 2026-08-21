/** Clears browser chat drafts for where2play (`w2p.chat.*`). */
export const CHAT_PREFIX = "w2p.chat.";
const CHAT_KEY_RE = /^w2p\.chat\./;

function storage(): Storage | null {
  if (typeof globalThis === "undefined") return null;
  return globalThis.localStorage ?? null;
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
