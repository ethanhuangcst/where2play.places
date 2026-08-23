import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { requireUser } from "@/src/auth/user";
import type { ItineraryDto, PlanBoundaries } from "@/src/core/itinerary-types";

export async function GET(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const row = await prisma.planSessionCache.findUnique({
    where: { userId: gate.user.id },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: true, criteria: null, itinerary: null });
  }

  return NextResponse.json({
    ok: true,
    criteria: row.criteriaJson as PlanBoundaries,
    itinerary: row.itineraryJson as ItineraryDto,
    updatedAt: row.updatedAt.toISOString(),
  });
}
