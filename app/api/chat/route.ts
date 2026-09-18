import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { requireUser, authError } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import { truncateChatMessages } from "@/src/core/chat-truncate";
import { mergeRefineSkeletonIntoItinerary } from "@/src/core/plan-chat-refine";
import { planTrip } from "@/src/places-agent/client";
import { t as catalogT } from "@/src/i18n/catalog";

export const maxDuration = 120;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  itinerary: z.custom<ItineraryDto>((v) => Boolean(v && typeof v === "object")),
  trip_id: z.string().min(1),
  revision: z.number().int().positive().optional(),
  locale: z.string().optional(),
});

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function contextMaxChars(): number {
  const raw = Number(process.env.CHAT_CONTEXT_MAX_CHARS ?? 12_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 12_000;
}

async function upsertPlanCache(userId: string, itinerary: ItineraryDto): Promise<void> {
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
  const lastUser = [...truncated].reverse().find((m) => m.role === "user");
  if (!lastUser?.content.trim()) {
    return authError("errors.validation", 400);
  }

  try {
    const envelope = await planTrip({
      city: parsed.data.itinerary.destination,
      trip_id: parsed.data.trip_id,
      revision: parsed.data.revision,
      locale,
      refine: { instruction: lastUser.content.trim() },
    });

    if (!envelope.ok || !envelope.data) {
      const key = envelope.outcome?.key ?? "errors.provider_failed";
      return authError(key, key === "errors.trip_revision_conflict" ? 409 : 502);
    }

    const data = envelope.data;
    const reply =
      typeof (data as { reply?: string }).reply === "string" && (data as { reply?: string }).reply
        ? (data as { reply: string }).reply
        : catalogT(locale, "play.chat.refine_default_reply");

    let next = parsed.data.itinerary;
    if (data.itinerary?.skeleton) {
      next = mergeRefineSkeletonIntoItinerary(
        parsed.data.itinerary,
        data.itinerary.skeleton,
        (key, vars) => catalogT(locale, key, vars),
      );
    }

    await upsertPlanCache(gate.user.id, next);

    return NextResponse.json({
      ok: true,
      reply,
      itinerary: next,
      trip_id: data.trip_id,
      revision: data.revision,
    });
  } catch {
    return authError("errors.chat_failed", 502);
  }
}
