import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import type { ItineraryDto, PlanBoundaries } from "@/src/core/itinerary-types";
import { refreshItineraryFromTripLedger } from "@/src/core/plan-session-cache";

export async function GET(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const row = await prisma.planSessionCache.findUnique({
    where: { userId: gate.user.id },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: true, criteria: null, itinerary: null });
  }

  let criteria = row.criteriaJson as PlanBoundaries;
  let itinerary = row.itineraryJson as ItineraryDto;
  const locale = normalizeLocale(criteria.locale ?? gate.user.locale);

  if (criteria.tripId) {
    const refreshed = await refreshItineraryFromTripLedger({
      criteria,
      cached: itinerary,
      locale,
    });
    if (refreshed) {
      criteria = refreshed.criteria;
      itinerary = refreshed.itinerary;
    }
  }

  return NextResponse.json({
    ok: true,
    criteria,
    itinerary,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  await prisma.planSessionCache.deleteMany({ where: { userId: gate.user.id } });
  return NextResponse.json({ ok: true });
}
