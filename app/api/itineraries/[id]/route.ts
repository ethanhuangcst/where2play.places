import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { authError, requireUser } from "@/src/auth/user";
import type { ChatMessageDto } from "@/src/core/saved-itinerary";
import type { ItineraryDto } from "@/src/core/itinerary-types";

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

  return NextResponse.json({
    itinerary: row.snapshot as ItineraryDto,
    messages,
    savedAt: row.savedAt.toISOString(),
    title: row.title,
    destination: row.destination,
    daysCount: row.daysCount,
  });
}
