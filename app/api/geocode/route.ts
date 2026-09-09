import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { geocode } from "@/src/places-agent/client";

const schema = z.object({
  query: z.string().trim().min(1),
  locale: z.string().optional(),
});

/** Forward geocode for takeoff destination blur (2play-plan-100). */
export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(parsed.data.locale ?? gate.user.locale);
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
    city: geo.data.city,
    city_en: geo.data.city_en,
  });
}
