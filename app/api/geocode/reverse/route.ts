import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { csrfOk } from "@/src/auth/csrf";
import { authError } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { toCityLabel } from "@/src/core/city-label";
import { providersForPin, reverseGeocode } from "@/src/places-agent/client";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!csrfOk(request)) return authError("errors.csrf", 403);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return authError("errors.validation", 400);

  const { lat, lng } = parsed.data;
  const locale = normalizeLocale(parsed.data.locale);
  const providers = providersForPin(lat, lng);

  const geo = await reverseGeocode({ lat, lng, locale, providers });
  if (!geo.ok || !geo.data?.label) {
    return authError(geo.outcome?.key ?? "errors.provider_failed", 502);
  }

  return NextResponse.json({
    label: toCityLabel(geo.data.label),
    lat: geo.data.lat,
    lng: geo.data.lng,
  });
}
