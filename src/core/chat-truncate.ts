export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/**
 * Truncate transcript to maxChars (content chars).
 * Prefer keeping the last system divider and everything after it; then fill from the end.
 */
export function truncateChatMessages(
  messages: ChatMessage[],
  maxChars: number,
): ChatMessage[] {
  if (maxChars <= 0) return [];
  if (totalChars(messages) <= maxChars) return messages;

  const lastSystem = findLastIndex(messages, (m) => m.role === "system");
  const tailStart = lastSystem >= 0 ? lastSystem : 0;
  const preferred = messages.slice(tailStart);
  if (totalChars(preferred) <= maxChars) {
    return takeFromEnd(preferred, maxChars);
  }
  return takeFromEnd(messages, maxChars);
}

function totalChars(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + m.content.length, 0);
}

function takeFromEnd(messages: ChatMessage[], maxChars: number): ChatMessage[] {
  const out: ChatMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (used + m.content.length > maxChars && out.length > 0) break;
    if (used + m.content.length > maxChars) {
      const slice = m.content.slice(-(maxChars - used));
      out.unshift({ ...m, content: slice });
      break;
    }
    out.unshift(m);
    used += m.content.length;
  }
  return out;
}

function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i]!)) return i;
  }
  return -1;
}
