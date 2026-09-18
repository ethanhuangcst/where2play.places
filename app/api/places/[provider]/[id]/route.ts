import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { resolvePlaceDetailsWithNameFallback } from "@/src/core/place-details-resolve";
import { getPlaceDetails, searchPlaces } from "@/src/places-agent/client";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ provider: string; id: string }> },
) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const { provider, id } = await ctx.params;
  const nativeId = decodeURIComponent(id);
  const locale = normalizeLocale(request.nextUrl.searchParams.get("locale") ?? gate.user.locale);
  const name = request.nextUrl.searchParams.get("name") ?? undefined;
  const city = request.nextUrl.searchParams.get("city") ?? undefined;
  const latRaw = request.nextUrl.searchParams.get("lat");
  const lngRaw = request.nextUrl.searchParams.get("lng");
  const lat = latRaw != null ? Number(latRaw) : NaN;
  const lng = lngRaw != null ? Number(lngRaw) : NaN;
  const near =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, crs: "GCJ-02" as const }
      : undefined;

  const resolved = await resolvePlaceDetailsWithNameFallback(
    {
      provider,
      nativeId,
      locale,
      ...(name ? { name } : {}),
      ...(city ? { city } : {}),
      ...(near ? { near } : {}),
    },
    {
      getPlaceDetails: async (input) => {
        const res = await getPlaceDetails(input);
        return { ok: res.ok, data: (res.data as Record<string, unknown> | null) ?? null };
      },
      searchPlaces: async (input) => {
        const res = await searchPlaces(input);
        const data = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : null;
        return { ok: res.ok, data };
      },
    },
  );

  if (!resolved.ok) {
    return NextResponse.json(
      { error: { key: resolved.key } },
      { status: resolved.key === "errors.invalid_input" ? 400 : 502 },
    );
  }
  return NextResponse.json({ ok: true, data: resolved.data });
}
