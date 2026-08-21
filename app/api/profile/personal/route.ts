import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { authError, requireUser, normalizeEmail } from "@/src/auth/user";
import { PHOTO_MAX_BYTES } from "@/src/auth/register-validation";
import { normalizeInterests } from "@/src/core/interests";

function photoUrlTooLarge(url: string | undefined): boolean {
  if (!url || !url.startsWith("data:image/")) return false;
  const base64 = url.split(",")[1] ?? "";
  return Math.ceil(base64.length * 0.75) > PHOTO_MAX_BYTES;
}

const personalSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  gender: z.string().optional(),
  age: z.coerce.number().int().min(1).max(120).optional(),
  defaultLocation: z.string().min(1),
  defaultLat: z.number().min(-90).max(90).optional().nullable(),
  defaultLng: z.number().min(-180).max(180).optional().nullable(),
  photoUrl: z
    .string()
    .optional()
    .refine((v) => !v || v.startsWith("data:image/") || /^https?:\/\//.test(v), { message: "invalid url" })
    .or(z.literal("")),
  interests: z.array(z.string()).optional(),
});

function interestsFromProfile(profile: { interests: unknown } | null | undefined): string[] {
  return normalizeInterests(profile?.interests);
}

export async function GET(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;
  const u = gate.user;
  return NextResponse.json({
    name: u.name,
    email: u.email,
    gender: u.gender,
    age: u.age,
    defaultLocation: u.defaultLocation,
    defaultLat: u.defaultLat,
    defaultLng: u.defaultLng,
    photoUrl: u.photoUrl,
    locale: u.locale,
    interests: interestsFromProfile(u.interestProfile),
    updatedAt: u.updatedAt.toISOString(),
  });
}

export async function PUT(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;
  const parsed = personalSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return authError("errors.validation", 400);
  if (photoUrlTooLarge(parsed.data.photoUrl || undefined)) {
    return authError("errors.photo_too_large", 400);
  }
  const email = normalizeEmail(parsed.data.email);
  if (email !== gate.user.email) {
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: gate.user.id } },
    });
    if (taken) return authError("errors.email_taken", 409);
  }
  const latProvided = parsed.data.defaultLat != null && parsed.data.defaultLng != null;
  const interests = normalizeInterests(parsed.data.interests ?? interestsFromProfile(gate.user.interestProfile));

  const updated = await prisma.user.update({
    where: { id: gate.user.id },
    data: {
      name: parsed.data.name.trim(),
      email,
      gender: parsed.data.gender || null,
      age: parsed.data.age,
      defaultLocation: parsed.data.defaultLocation.trim(),
      defaultLat: latProvided ? parsed.data.defaultLat : null,
      defaultLng: latProvided ? parsed.data.defaultLng : null,
      photoUrl: parsed.data.photoUrl || null,
      interestProfile: {
        upsert: {
          create: { interests },
          update: { interests },
        },
      },
    },
    include: { interestProfile: true },
  });
  return NextResponse.json({
    name: updated.name,
    email: updated.email,
    gender: updated.gender,
    age: updated.age,
    defaultLocation: updated.defaultLocation,
    defaultLat: updated.defaultLat,
    defaultLng: updated.defaultLng,
    photoUrl: updated.photoUrl,
    interests: interestsFromProfile(updated.interestProfile),
    updatedAt: updated.updatedAt.toISOString(),
  });
}
