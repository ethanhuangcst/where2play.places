import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { prisma } from "@/src/db/client";
import { normalizeLocale } from "@/src/core/locales";
import type { ItineraryDto, PlanBoundaries } from "@/src/core/itinerary-types";
import {
  emptyPlanItinerary,
  upsertPlanSessionCache,
} from "@/src/core/plan-session-cache";
import { geocode, patchTrip, searchPlaces, providersForDestinationText } from "@/src/places-agent/client";
import {
  INTAKE_STEP_ORDER,
  tripConstraintsFromIntakeStep,
  type IntakeStepId,
} from "@/src/core/plan-intake";
import { resolvePlanOrigin } from "@/src/core/plan-resolve-origin";
import { t as catalogT } from "@/src/i18n/catalog";

export async function PATCH(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const raw = await request.json().catch(() => ({}));
  const step = typeof raw.step === "string" ? raw.step : "";
  if (!INTAKE_STEP_ORDER.includes(step as IntakeStepId)) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }
  const value = typeof raw.value === "string" ? raw.value : "";
  const locale = normalizeLocale(
    typeof raw.locale === "string" ? raw.locale : gate.user.locale,
  );
  const t = (key: string) => catalogT(locale, key);
  let resolvedValue = value;

  const existing = await prisma.planSessionCache.findUnique({
    where: { userId: gate.user.id },
  });
  const prev = (existing?.criteriaJson ?? {}) as PlanBoundaries;

  if (step === "b" && value.trim()) {
    const dest = prev.destination ?? "";
    const resolved = await resolvePlanOrigin(
      {
        query: value,
        destination: dest,
        locale,
        providers: dest ? providersForDestinationText(dest) : undefined,
      },
      { searchPlaces, geocode },
    );
    if (resolved.kind === "not_found") {
      return NextResponse.json(
        { ok: false, error: { key: "play.plan.intake_origin_not_found" } },
        { status: 422 },
      );
    }
    if (resolved.kind === "hit") {
      resolvedValue = resolved.name;
      prev.originLat = resolved.lat;
      prev.originLng = resolved.lng;
    } else if (resolved.kind === "degraded") {
      resolvedValue = resolved.name;
      delete prev.originLat;
      delete prev.originLng;
    }
  }
  if (step === "b" && !value.trim()) {
    delete prev.originLat;
    delete prev.originLng;
  }

  const patch = tripConstraintsFromIntakeStep(step as IntakeStepId, resolvedValue, t);
  const tripId =
    typeof raw.trip_id === "string" && raw.trip_id.trim()
      ? raw.trip_id.trim()
      : prev.tripId;
  const criteria: PlanBoundaries = {
    ...prev,
    ...("hotel" in patch ? { dailyStart: String(patch.hotel ?? "") } : {}),
    ...("timeFrom" in patch ? { timeFrom: String(patch.timeFrom) } : {}),
    ...("tripType" in patch ? { tripType: String(patch.tripType) } : {}),
    ...("pace" in patch ? { pace: String(patch.pace) } : {}),
    ...("transport" in patch ? { transport: String(patch.transport) } : {}),
    ...("must_include" in patch
      ? { mustInclude: Array.isArray(patch.must_include) ? (patch.must_include as string[]) : [] }
      : {}),
    ...("notes" in patch ? { constraints: String(patch.notes ?? "") } : {}),
    ...(tripId ? { tripId } : {}),
    locale,
    originLat: prev.originLat,
    originLng: prev.originLng,
  };
  if (!criteria.destination) {
    criteria.destination = prev.destination ?? "";
  }
  if (!criteria.startDate) {
    criteria.startDate = prev.startDate ?? "";
  }
  if (!criteria.days) {
    criteria.days = prev.days ?? 1;
  }

  const itinerary = (existing?.itineraryJson as ItineraryDto) ?? emptyPlanItinerary(criteria);
  await upsertPlanSessionCache(gate.user.id, criteria, itinerary);

  if (tripId) {
    const written = await patchTrip({
      trip_id: tripId,
      locale,
      constraints: patch,
      ...(typeof raw.revision === "number" ? { revision: raw.revision } : {}),
    });
    if (!written.ok) {
      return NextResponse.json(
        { ok: false, error: { key: written.outcome?.key ?? "errors.provider_failed" } },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      trip_id: written.data?.trip_id ?? tripId,
      revision: written.data?.revision,
      originLat: criteria.originLat,
      originLng: criteria.originLng,
    });
  }

  return NextResponse.json({
    ok: true,
    trip_id: tripId,
    originLat: criteria.originLat,
    originLng: criteria.originLng,
  });
}
