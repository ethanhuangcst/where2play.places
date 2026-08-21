import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { csrfOk } from "@/src/auth/csrf";
import { authError, requireUser } from "@/src/auth/user";
import { writeLocaleCookie } from "@/src/auth/session";

const schema = z.object({ locale: z.enum(["EN", "CN", "HK", "TW"]) });

export async function POST(request: NextRequest) {
  if (!csrfOk(request)) return authError("errors.csrf", 403);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return authError("errors.validation", 400);
  await writeLocaleCookie(parsed.data.locale);
  const session = await requireUser(request);
  if ("error" in session) return session.error;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale: parsed.data.locale },
  });
  return NextResponse.json({ ok: true, locale: parsed.data.locale });
}
