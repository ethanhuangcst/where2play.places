import { NextResponse } from "next/server";
import { readSession } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { displayName } from "@/src/auth/user";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ name: null });
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ name: null });
  return NextResponse.json({
    id: user.id,
    name: displayName(user.name),
    email: user.email,
    locale: user.locale,
    photoUrl: user.photoUrl,
  });
}
