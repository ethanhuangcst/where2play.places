import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { hashPassword } from "@/src/core/crypto";
import { writeSession } from "@/src/auth/session";
import { csrfOk } from "@/src/auth/csrf";
import { authError, normalizeEmail } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { normalizeInterests } from "@/src/core/interests";
import { PHOTO_MAX_BYTES, registerSchemaFailure } from "@/src/auth/register-validation";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  gender: z.string().optional(),
  age: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    },
    z.number().int().min(13).max(120).optional(),
  ),
  defaultLocation: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed ? trimmed : undefined;
    }),
  defaultLat: z.number().min(-90).max(90).optional(),
  defaultLng: z.number().min(-180).max(180).optional(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  locale: z.string().optional(),
  interests: z.array(z.string()).optional(),
  photoUrl: z
    .string()
    .optional()
    .refine((v) => !v || v.startsWith("data:image/") || /^https?:\/\//.test(v), { message: "invalid url" }),
});

function photoUrlTooLarge(url: string | undefined): boolean {
  if (!url || !url.startsWith("data:image/")) return false;
  const base64 = url.split(",")[1] ?? "";
  return Math.ceil(base64.length * 0.75) > PHOTO_MAX_BYTES;
}

export async function POST(request: NextRequest) {
  if (!csrfOk(request)) return authError("errors.csrf", 403);
  const body = await request.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const failure = registerSchemaFailure(parsed.error);
    return authError(failure.key, 400, failure.field);
  }
  const data = parsed.data;
  if (data.password !== data.confirmPassword) {
    return authError("errors.password_mismatch", 400, "password_confirm");
  }
  if (photoUrlTooLarge(data.photoUrl)) return authError("errors.photo_too_large", 400);
  const email = normalizeEmail(data.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return authError("errors.email_taken", 409);
  const passwordHash = await hashPassword(data.password);
  const latLng =
    data.defaultLat != null && data.defaultLng != null
      ? { defaultLat: data.defaultLat, defaultLng: data.defaultLng }
      : {};
  const interests = normalizeInterests(data.interests ?? []);
  const user = await prisma.user.create({
    data: {
      email,
      name: data.name.trim(),
      gender: data.gender || null,
      age: data.age,
      defaultLocation: data.defaultLocation?.trim() ?? null,
      photoUrl: data.photoUrl || null,
      ...latLng,
      passwordHash,
      locale: normalizeLocale(data.locale),
      interestProfile: { create: { interests } },
    },
  });
  await writeSession({ userId: user.id, email: user.email });
  return NextResponse.json({ ok: true, key: "auth.register_success" });
}
