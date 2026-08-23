import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { authError, requireUser } from "@/src/auth/user";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;
  const { id } = await context.params;
  const row = await prisma.savedItinerary.findFirst({
    where: { id, userId: gate.user.id },
  });
  if (!row) return authError("errors.not_found", 404);
  await prisma.savedItinerary.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
