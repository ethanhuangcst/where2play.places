import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { csrfOk } from "@/src/auth/csrf";
import { authError } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { geocode } from "@/src/places-agent/client";

const schema = z.object({
  query: z.string().trim().min(1),
  locale: z.string().optional(),
});

/**
 * Forward geocode (name → coords).
 * CSRF-protected; no session required so register can resolve default departure
 * the same way takeoff destination blur does.
 */
export async function POST(request: NextRequest) {
  if (!csrfOk(request)) return authError("errors.csrf", 403);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(parsed.data.locale);
  const geo = await geocode({ query: parsed.data.query, locale });
  if (!geo.ok || !geo.data) {
    return NextResponse.json(
      { ok: false, error: { key: geo.outcome?.key ?? "play.plan.dest_geocode_failed" } },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    lat: geo.data.lat,
    lng: geo.data.lng,
    crs: geo.data.crs,
    address: geo.data.label,
    country: geo.data.country,
    country_code: geo.data.country_code,
    city: geo.data.city,
    city_en: geo.data.city_en,
  });
}
