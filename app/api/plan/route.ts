import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { requireUser, authError } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { validatePlanBoundaries } from "@/src/core/plan-validate";
import { planItineraryDayByDay, type PlanProgressEvent } from "@/src/core/plan-day-by-day";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import { providersForDestinationText } from "@/src/places-agent/client";

export const maxDuration = 300;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function upsertPlanCache(
  userId: string,
  criteria: unknown,
  itinerary: ItineraryDto,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.planSessionCache.upsert({
    where: { userId },
    create: {
      userId,
      criteriaJson: criteria as object,
      itineraryJson: itinerary as object,
      expiresAt,
    },
    update: {
      criteriaJson: criteria as object,
      itineraryJson: itinerary as object,
      expiresAt,
    },
  });
}

function encodeNdjson(event: PlanProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const raw = await request.json().catch(() => ({}));
  const parsed = validatePlanBoundaries(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: { key: "errors.validation", fields: parsed.errors } },
      { status: 400 },
    );
  }

  const locale = normalizeLocale(parsed.value.locale ?? gate.user.locale);
  const providers = providersForDestinationText(parsed.value.destination);
  const stream = request.headers.get("accept")?.includes("application/x-ndjson");

  if (!stream) {
    let last: ItineraryDto | null = null;
    let errorKey: string | null = null;
    for await (const event of planItineraryDayByDay(parsed.value, { locale, providers })) {
      if (event.type === "error") {
        errorKey = event.key;
        break;
      }
      if (event.type === "done" || event.type === "day_done" || event.type === "progress") {
        last = event.itinerary;
        await upsertPlanCache(gate.user.id, parsed.value, event.itinerary);
      }
    }
    if (!last) {
      return authError(errorKey ?? "errors.provider_failed", 502);
    }
    return NextResponse.json({
      ok: true,
      itinerary: last,
      updatedAt: last.updatedAt,
    });
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of planItineraryDayByDay(parsed.value, { locale, providers })) {
          if (event.type === "progress" || event.type === "day_done" || event.type === "done") {
            await upsertPlanCache(gate.user.id, parsed.value, event.itinerary);
          }
          controller.enqueue(encodeNdjson(event));
          if (event.type === "error" || event.type === "done") break;
        }
      } catch {
        controller.enqueue(
          encodeNdjson({ type: "error", key: "errors.provider_failed" }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
