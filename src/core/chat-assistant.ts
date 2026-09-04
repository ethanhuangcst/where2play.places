import type { ItineraryDto } from "./itinerary-types";
import type { ChatMessage } from "./chat-truncate";
import type { ItineraryPatch } from "./itinerary-patch";
import { openaiApiBaseUrl } from "./openai-config";
import { chatLlmConfigured, resolveChatLlmConfig } from "./llm-chat-config";

export type AssistantParseResult = {
  reply: string;
  itineraryPatch?: ItineraryPatch;
  itinerary?: ItineraryDto;
};

export function summarizeItinerary(itinerary: ItineraryDto): string {
  const lines: string[] = [
    `Title: ${itinerary.title}`,
    `Destination: ${itinerary.destination}`,
    `Days: ${itinerary.daysCount}`,
  ];
  for (const day of itinerary.days) {
    lines.push(`Day ${day.dayIndex} — ${day.highlights.title}`);
    for (const slot of day.slots) {
      if (slot.kind === "transit") {
        lines.push(`  ${slot.start} transit: ${slot.text}`);
      } else {
        lines.push(
          `  ${slot.start}-${slot.end} [${slot.placeKind}] ${slot.name} — ${slot.summary}`,
        );
      }
    }
  }
  return lines.join("\n");
}

export function buildAssistantSystemPrompt(input: {
  locale: string;
  itinerary: ItineraryDto;
}): string {
  return [
    "You are the where2play itinerary assistant.",
    `Respond in locale ${input.locale}.`,
    "Task: small edits to an EXISTING itinerary from the user's chat.",
    "Do NOT call or suggest places-agent /v1/chat.",
    "Do NOT trigger a full plan_itinerary rebuild; for full redo the user uses replan.",
    "Return ONLY a JSON object (optional markdown fence) with:",
    '- "reply": string (natural language for the user)',
    '- optional "itineraryPatch": partial update { title?, days?: [{ dayIndex, slots?, highlights?, meta? }] }',
    '- optional "itinerary": full ItineraryDto replacement (only if patch is insufficient)',
    "Prefer itineraryPatch over full itinerary.",
    "Keep place facts honest; do not invent photos or map URLs.",
    "",
    "Current itinerary summary:",
    summarizeItinerary(input.itinerary),
  ].join("\n");
}

export function buildAssistantUserPayload(input: {
  messages: ChatMessage[];
  itinerary: ItineraryDto;
}): string {
  const transcript = input.messages
    .filter((m) => m.role !== "system" || m.content.trim())
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  return [
    "Conversation:",
    transcript || "(empty)",
    "",
    "Itinerary JSON (authoritative structure for patches):",
    JSON.stringify(input.itinerary),
  ].join("\n");
}

export function parseAssistantModelText(raw: string): AssistantParseResult {
  const jsonStr = extractJson(raw);
  try {
    const parsed = JSON.parse(jsonStr) as {
      reply?: unknown;
      itineraryPatch?: ItineraryPatch;
      itinerary?: ItineraryDto;
    };
    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : raw.trim();
    return {
      reply,
      ...(parsed.itineraryPatch ? { itineraryPatch: parsed.itineraryPatch } : {}),
      ...(parsed.itinerary ? { itinerary: parsed.itinerary } : {}),
    };
  } catch {
    return { reply: raw.trim() || "…" };
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

export type ChatLlmComplete = (args: {
  system: string;
  user: string;
  signal?: AbortSignal;
}) => Promise<string>;

let chatLlmOverride: ChatLlmComplete | null = null;

export function setChatLlmCompleteForTests(fn: ChatLlmComplete | null): void {
  chatLlmOverride = fn;
}

export function openaiConfigured(): boolean {
  return chatLlmConfigured();
}

export async function completeAssistantChat(args: {
  system: string;
  user: string;
  signal?: AbortSignal;
}): Promise<string> {
  if (chatLlmOverride) return chatLlmOverride(args);

  const cfg = resolveChatLlmConfig();
  if (!cfg) {
    throw Object.assign(new Error("openai_not_configured"), {
      outcomeKey: "errors.openai_not_configured",
    });
  }

  const apiKey = cfg.apiKey;
  const base = cfg.baseURL || openaiApiBaseUrl();
  const model = cfg.model;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      stream: true,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    throw Object.assign(new Error("chat_llm_failed"), {
      outcomeKey: "errors.chat_failed",
    });
  }

  // Collect streamed tokens into full text (route can also re-stream to client).
  if (!res.body) {
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? "";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch {
        /* ignore partial */
      }
    }
  }
  return content;
}

/** Stream tokens via callback while collecting full text (for BFF NDJSON). */
export async function streamAssistantChat(args: {
  system: string;
  user: string;
  signal?: AbortSignal;
  onToken?: (text: string) => void;
}): Promise<string> {
  if (chatLlmOverride) {
    const full = await chatLlmOverride(args);
    // Emit reply prose roughly: if JSON, stream the reply field chars; else whole text
    const parsed = parseAssistantModelText(full);
    if (args.onToken && parsed.reply) {
      for (const ch of parsed.reply) args.onToken(ch);
    }
    return full;
  }

  const cfg = resolveChatLlmConfig();
  if (!cfg) {
    throw Object.assign(new Error("openai_not_configured"), {
      outcomeKey: "errors.openai_not_configured",
    });
  }

  const apiKey = cfg.apiKey;
  const base = cfg.baseURL || openaiApiBaseUrl();
  const model = cfg.model;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      stream: true,
    }),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    throw Object.assign(new Error("chat_llm_failed"), {
      outcomeKey: "errors.chat_failed",
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          args.onToken?.(delta);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return content;
}
