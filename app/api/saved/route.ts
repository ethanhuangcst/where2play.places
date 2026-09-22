import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { authError, requireUser } from "@/src/auth/user";
import { coverUrlFromSnapshot, toSavedTripListItem } from "@/src/core/saved-itinerary";
import type { PlanBoundaries } from "@/src/core/itinerary-types";
import { stripItinerarySnapshot } from "@/src/core/plan-save-snapshot";

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
  tripId: z.string().min(1).optional(),
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

  const itinerary = stripItinerarySnapshot(parsed.data.itinerary);
  const coverUrl = coverUrlFromSnapshot(itinerary);

  let tripId = parsed.data.tripId?.trim() || undefined;
  if (!tripId) {
    const session = await prisma.planSessionCache.findUnique({
      where: { userId: gate.user.id },
    });
    if (session && session.expiresAt.getTime() > Date.now()) {
      const criteria = session.criteriaJson as PlanBoundaries;
      if (typeof criteria.tripId === "string" && criteria.tripId.trim()) {
        tripId = criteria.tripId.trim();
      }
    }
  }

  const messageRows = parsed.data.messages.map((m, ord) => ({
    role: m.role,
    content: m.content,
    ord,
    createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
  }));

  const result = await prisma.$transaction(async (tx) => {
    if (tripId) {
      const existing = await tx.savedItinerary.findFirst({
        where: { userId: gate.user.id, tripId },
      });
      if (existing) {
        await tx.itineraryChatMessage.deleteMany({ where: { itineraryId: existing.id } });
        const saved = await tx.savedItinerary.update({
          where: { id: existing.id },
          data: {
            title: itinerary.title,
            destination: itinerary.destination,
            daysCount: itinerary.daysCount,
            coverUrl: coverUrl ?? null,
            snapshot: itinerary as unknown as Prisma.InputJsonValue,
            savedAt: new Date(),
          },
        });
        if (messageRows.length > 0) {
          await tx.itineraryChatMessage.createMany({
            data: messageRows.map((m) => ({
              itineraryId: saved.id,
              role: m.role,
              content: m.content,
              ord: m.ord,
              ...(m.createdAt ? { createdAt: m.createdAt } : {}),
            })),
          });
        }
        return { row: saved, updated: true as const };
      }
    }

    const saved = await tx.savedItinerary.create({
      data: {
        userId: gate.user.id,
        title: itinerary.title,
        destination: itinerary.destination,
        daysCount: itinerary.daysCount,
        coverUrl: coverUrl ?? null,
        snapshot: itinerary as unknown as Prisma.InputJsonValue,
        tripId: tripId ?? null,
      },
    });
    if (messageRows.length > 0) {
      await tx.itineraryChatMessage.createMany({
        data: messageRows.map((m) => ({
          itineraryId: saved.id,
          role: m.role,
          content: m.content,
          ord: m.ord,
          ...(m.createdAt ? { createdAt: m.createdAt } : {}),
        })),
      });
    }
    return { row: saved, updated: false as const };
  });

  return NextResponse.json(
    {
      id: result.row.id,
      savedAt: result.row.savedAt.toISOString(),
      updated: result.updated,
    },
    { status: result.updated ? 200 : 201 },
  );
}
