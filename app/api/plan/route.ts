import { NextRequest, NextResponse } from "next/server";
import { requireUser, authError } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { validatePlanBoundaries } from "@/src/core/plan-validate";
import { planItineraryDayByDay, type PlanProgressEvent } from "@/src/core/plan-day-by-day";
import {
  planItinerarySkeletonFill,
  planPipelineMode,
  type SkeletonPlanProgressEvent,
} from "@/src/core/plan-skeleton-fill";
import { planItinerarySkeletonOnly } from "@/src/core/plan-skeleton-only";
import type { ItineraryDto, PlanBoundaries } from "@/src/core/itinerary-types";
import { providersForDestinationText } from "@/src/places-agent/client";
import {
  emptyPlanItinerary,
  extractPlanLedgerFromEvent,
  mergePlanCriteria,
  shouldPersistPlanCacheEvent,
  upsertPlanSessionCache,
  type PlanLedger,
} from "@/src/core/plan-session-cache";

export const maxDuration = 300;

async function upsertPlanCache(
  userId: string,
  criteria: PlanBoundaries,
  itinerary: ItineraryDto,
): Promise<void> {
  await upsertPlanSessionCache(userId, criteria, itinerary);
}

function encodeNdjson(event: PlanProgressEvent | SkeletonPlanProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function planStream(
  criteria: PlanBoundaries,
  locale: string,
  providers: string[],
): AsyncGenerator<PlanProgressEvent | SkeletonPlanProgressEvent> {
  if (criteria.planMode === "skeleton") {
    return planItinerarySkeletonOnly(criteria, { locale, providers });
  }
  if (planPipelineMode() === "legacy") {
    return planItineraryDayByDay(criteria, { locale, providers });
  }
  return planItinerarySkeletonFill(criteria, { locale, providers });
}

function applyLedger(ledger: PlanLedger, patch: PlanLedger | null): PlanLedger {
  if (!patch) return ledger;
  return {
    tripId: patch.tripId ?? ledger.tripId,
    revision: patch.revision ?? ledger.revision,
  };
}

async function persistPlanProgress(
  userId: string,
  baseCriteria: PlanBoundaries,
  ledger: PlanLedger,
  itinerary: ItineraryDto,
): Promise<void> {
  await upsertPlanCache(userId, mergePlanCriteria(baseCriteria, ledger), itinerary);
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

  let ledger: PlanLedger = {
    tripId: parsed.value.tripId,
    revision: parsed.value.revision,
  };
  let lastItinerary: ItineraryDto = emptyPlanItinerary(parsed.value);

  if (!stream) {
    let last: ItineraryDto | null = null;
    let errorKey: string | null = null;
    for await (const event of planStream(parsed.value, locale, providers)) {
      const ledgerPatch = extractPlanLedgerFromEvent(event);
      if (ledgerPatch) {
        ledger = applyLedger(ledger, ledgerPatch);
        await persistPlanProgress(gate.user.id, parsed.value, ledger, lastItinerary);
      }
      if (event.type === "error") {
        errorKey = event.key;
        break;
      }
      if (shouldPersistPlanCacheEvent(event) && "itinerary" in event && event.itinerary) {
        last = event.itinerary;
        lastItinerary = event.itinerary;
        await persistPlanProgress(gate.user.id, parsed.value, ledger, event.itinerary);
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
        for await (const event of planStream(parsed.value, locale, providers)) {
          const ledgerPatch = extractPlanLedgerFromEvent(event);
          if (ledgerPatch) {
            ledger = applyLedger(ledger, ledgerPatch);
            await persistPlanProgress(gate.user.id, parsed.value, ledger, lastItinerary);
          }
          if (shouldPersistPlanCacheEvent(event) && "itinerary" in event && event.itinerary) {
            lastItinerary = event.itinerary;
            await persistPlanProgress(gate.user.id, parsed.value, ledger, event.itinerary);
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
