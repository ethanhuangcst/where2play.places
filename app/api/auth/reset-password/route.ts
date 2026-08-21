import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/src/db/client";
import { hashToken } from "@/src/core/crypto";
import { csrfOk } from "@/src/auth/csrf";
import { authError, normalizeEmail } from "@/src/auth/user";
import { resetMailContent, sendMail } from "@/src/auth/mail";
import { normalizeLocale } from "@/src/core/locales";

export async function POST(request: NextRequest) {
  if (!csrfOk(request)) return authError("errors.csrf", 403);
  const body = (await request.json().catch(() => ({}))) as { email?: string; locale?: string };
  const email = normalizeEmail(body.email ?? "");
  const locale = normalizeLocale(body.locale);
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user) {
    const token = randomUUID();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const mail = resetMailContent(locale, token);
    await sendMail({ to: user.email, ...mail });
  }
  return NextResponse.json({ ok: true, key: "errors.reset_sent" });
}
