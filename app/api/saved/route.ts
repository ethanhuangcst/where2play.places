import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { authError, requireUser } from "@/src/auth/user";
import { coverUrlFromSnapshot, toSavedTripListItem } from "@/src/core/saved-itinerary";
import type { ItineraryDto } from "@/src/core/itinerary-types";

const itinerarySchema = z.object({
  title: z.string().min(1),
  destination: z.string().min(1),
  daysCount: z.number().int().min(1),
  updatedAt: z.string(),
  days: z.array(z.unknown()),
});

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string().optional(),
});

const saveSchema = z.object({
  itinerary: itinerarySchema,
  messages: z.array(chatMessageSchema).default([]),
});

export async function GET(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;
  const rows = await prisma.savedItinerary.findMany({
    where: { userId: gate.user.id },
    orderBy: { savedAt: "desc" },
  });
  return NextResponse.json({
    trips: rows.map((r) => toSavedTripListItem(r)),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;
  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return authError("errors.validation", 400);

  const itinerary = parsed.data.itinerary as ItineraryDto;
  const coverUrl = coverUrlFromSnapshot(itinerary);

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.savedItinerary.create({
      data: {
        userId: gate.user.id,
        title: itinerary.title,
        destination: itinerary.destination,
        daysCount: itinerary.daysCount,
        coverUrl: coverUrl ?? null,
        snapshot: itinerary as unknown as Prisma.InputJsonValue,
      },
    });
    if (parsed.data.messages.length > 0) {
      await tx.itineraryChatMessage.createMany({
        data: parsed.data.messages.map((m, ord) => ({
          itineraryId: saved.id,
          role: m.role,
          content: m.content,
          ord,
          createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        })),
      });
    }
    return saved;
  });

  return NextResponse.json({ id: row.id, savedAt: row.savedAt.toISOString() }, { status: 201 });
}
