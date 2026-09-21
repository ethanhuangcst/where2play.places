import type { ItineraryDto } from "./itinerary-types";
import { INTAKE_STEP_ORDER, type IntakeAnswers } from "./plan-intake";
import { truncateChatMessages, type ChatMessage } from "./chat-truncate";

const DEFAULT_CHAT_MAX_CHARS = 8000;

/** Persistable ItineraryDto fields only — drop visa/tips/artifacts if present. */
export function stripItinerarySnapshot(input: unknown): ItineraryDto {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    title: String(raw.title ?? ""),
    destination: String(raw.destination ?? ""),
    daysCount: Number(raw.daysCount) || 1,
    updatedAt: String(raw.updatedAt ?? ""),
    days: Array.isArray(raw.days) ? (raw.days as ItineraryDto["days"]) : [],
  };
}

export function chatContextMaxChars(): number {
  const n = Number(process.env.CHAT_CONTEXT_MAX_CHARS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAT_MAX_CHARS;
}

export type SerializePlanSaveMessagesInput = {
  intakeAnswers: IntakeAnswers;
  statusLines: string[];
  completeLine?: string | null;
  maxChars?: number;
};

/**
 * Plan assistant thread snapshot for POST /api/saved:
 * user = filled intake answers (order b–h); assistant = status lines + complete line.
 * Truncated via chat-truncate; never invents copy.
 */
export function serializePlanSaveMessages(
  input: SerializePlanSaveMessagesInput,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const step of INTAKE_STEP_ORDER) {
    const raw = input.intakeAnswers[step];
    if (typeof raw !== "string") continue;
    const content = raw.trim();
    if (!content) continue;
    messages.push({ role: "user", content });
  }

  for (const line of input.statusLines) {
    const content = line.trim();
    if (!content) continue;
    messages.push({ role: "assistant", content });
  }

  const complete = input.completeLine?.trim();
  if (complete) {
    messages.push({ role: "assistant", content: complete });
  }

  const maxChars = input.maxChars ?? chatContextMaxChars();
  return truncateChatMessages(messages, maxChars);
}
