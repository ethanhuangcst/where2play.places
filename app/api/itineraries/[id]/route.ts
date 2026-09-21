import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { authError, requireUser } from "@/src/auth/user";
import type { ChatMessageDto } from "@/src/core/saved-itinerary";
import type { ItineraryDto, PlanBoundaries } from "@/src/core/itinerary-types";
import { normalizeLocale } from "@/src/core/locales";
import { fetchTripDetails } from "@/src/places-agent/client";
import { travelTipsPayloadFromSlice, tripFetchSlice } from "@/src/core/plan-fetch-trip";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;
  const { id } = await context.params;
  const row = await prisma.savedItinerary.findFirst({
    where: { id, userId: gate.user.id },
    include: {
      messages: { orderBy: { ord: "asc" } },
    },
  });
  if (!row) return authError("errors.not_found", 404);

  const messages: ChatMessageDto[] = row.messages.map((m) => ({
    role: m.role as ChatMessageDto["role"],
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  let travelTips: Record<string, unknown> | undefined;
  let tipsStartDate: string | undefined;
  let tipsDays: number | undefined;

  const session = await prisma.planSessionCache.findUnique({
    where: { userId: gate.user.id },
  });
  if (session && session.expiresAt.getTime() > Date.now()) {
    const criteria = session.criteriaJson as PlanBoundaries;
    const destMatch =
      typeof criteria.destination === "string" &&
      criteria.destination.trim().toLowerCase() === row.destination.trim().toLowerCase();
    if (destMatch && criteria.tripId) {
      const locale = normalizeLocale(criteria.locale ?? gate.user.locale);
      const fetched = await fetchTripDetails({
        trip_id: criteria.tripId,
        fields: ["artifacts"],
        locale,
        ...(typeof criteria.revision === "number" ? { revision: criteria.revision } : {}),
      });
      if (fetched.ok) {
        const { slice } = tripFetchSlice(fetched);
        const tips = travelTipsPayloadFromSlice(slice);
        if (tips) {
          travelTips = tips;
          if (criteria.startDate) tipsStartDate = criteria.startDate;
          if (typeof criteria.days === "number") tipsDays = criteria.days;
        }
      }
    }
  }

  return NextResponse.json({
    itinerary: row.snapshot as ItineraryDto,
    messages,
    savedAt: row.savedAt.toISOString(),
    title: row.title,
    destination: row.destination,
    daysCount: row.daysCount,
    ...(travelTips ? { travelTips } : {}),
    ...(tipsStartDate ? { startDate: tipsStartDate } : {}),
    ...(typeof tipsDays === "number" ? { days: tipsDays } : {}),
  });
}
