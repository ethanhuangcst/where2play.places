import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { requireUser, authError } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import { truncateChatMessages } from "@/src/core/chat-truncate";
import {
  buildAssistantSystemPrompt,
  buildAssistantUserPayload,
  parseAssistantModelText,
  streamAssistantChat,
} from "@/src/core/chat-assistant";
import { applyAssistantItineraryResult } from "@/src/core/itinerary-patch";

export const maxDuration = 120;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  itinerary: z.custom<ItineraryDto>((v) => Boolean(v && typeof v === "object")),
  itineraryId: z.string().optional(),
  locale: z.string().optional(),
});

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function contextMaxChars(): number {
  const raw = Number(process.env.CHAT_CONTEXT_MAX_CHARS ?? 12_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 12_000;
}

function encodeNdjson(event: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

async function upsertPlanCache(
  userId: string,
  itinerary: ItineraryDto,
): Promise<void> {
  const existing = await prisma.planSessionCache.findUnique({ where: { userId } });
  if (!existing) return;
  await prisma.planSessionCache.update({
    where: { userId },
    data: {
      itineraryJson: itinerary as object,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return authError("errors.validation", 400);
  }

  const locale = normalizeLocale(parsed.data.locale ?? gate.user.locale);
  const truncated = truncateChatMessages(parsed.data.messages, contextMaxChars());
  const system = buildAssistantSystemPrompt({
    locale,
    itinerary: parsed.data.itinerary,
  });
  const user = buildAssistantUserPayload({
    messages: truncated,
    itinerary: parsed.data.itinerary,
  });

  const wantStream = request.headers.get("accept")?.includes("application/x-ndjson");

  try {
    if (!wantStream) {
      const raw = await streamAssistantChat({ system, user });
      const parsedOut = parseAssistantModelText(raw);
      const next = applyAssistantItineraryResult(parsed.data.itinerary, parsedOut);
      await upsertPlanCache(gate.user.id, next);
      return NextResponse.json({
        ok: true,
        reply: parsedOut.reply,
        ...(parsedOut.itineraryPatch ? { itineraryPatch: parsedOut.itineraryPatch } : {}),
        itinerary: next,
      });
    }

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const raw = await streamAssistantChat({ system, user });
          const parsedOut = parseAssistantModelText(raw);
          const next = applyAssistantItineraryResult(parsed.data.itinerary, parsedOut);
          await upsertPlanCache(gate.user.id, next);
          for (const ch of parsedOut.reply) {
            controller.enqueue(encodeNdjson({ type: "token", text: ch }));
          }
          controller.enqueue(
            encodeNdjson({
              type: "done",
              reply: parsedOut.reply,
              ...(parsedOut.itineraryPatch
                ? { itineraryPatch: parsedOut.itineraryPatch }
                : {}),
              itinerary: next,
            }),
          );
        } catch (err) {
          const key =
            err && typeof err === "object" && "outcomeKey" in err
              ? String((err as { outcomeKey: string }).outcomeKey)
              : "errors.chat_failed";
          controller.enqueue(encodeNdjson({ type: "error", key }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const key =
      err && typeof err === "object" && "outcomeKey" in err
        ? String((err as { outcomeKey: string }).outcomeKey)
        : "errors.chat_failed";
    return authError(key, key === "errors.openai_not_configured" ? 503 : 502);
  }
}
