import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { geocode, getPlaceDetails, searchPlaces, suggestPlaces } from "@/src/places-agent/client";
import { resolvePlanOriginWithPhotos } from "@/src/core/plan-resolve-origin";

const schema = z.object({
  query: z.string(),
  destination: z.string().trim().min(1),
  locale: z.string().optional(),
});

/** Takeoff origin blur — same resolve rules as intake step b (2play-plan-100). */
export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(parsed.data.locale ?? gate.user.locale);
  const resolved = await resolvePlanOriginWithPhotos(
    {
      query: parsed.data.query,
      destination: parsed.data.destination,
      locale,
    },
    {
      searchPlaces,
      suggestPlaces,
      geocode,
      getPlaceDetails: async (input) => {
        const res = await getPlaceDetails({
          provider: input.provider,
          native_id: input.native_id,
          locale: input.locale,
          ...(input.providers?.length ? { providers: input.providers } : {}),
        });
        return {
          ok: res.ok,
          data: res.data
            ? {
                photos: Array.isArray((res.data as { photos?: unknown }).photos)
                  ? ((res.data as { photos: string[] }).photos)
                  : undefined,
              }
            : null,
        };
      },
    },
  );

  if (resolved.kind === "hit") {
    return NextResponse.json({
      ok: true,
      kind: "hit",
      name: resolved.name,
      lat: resolved.lat,
      lng: resolved.lng,
      provider: resolved.provider,
      native_id: resolved.native_id,
      ...(resolved.photos?.length ? { photos: resolved.photos } : {}),
    });
  }

  if (resolved.kind === "skip") {
    return NextResponse.json({
      ok: true,
      kind: "skip",
      lat: resolved.lat,
      lng: resolved.lng,
    });
  }

  if (resolved.kind === "candidates") {
    return NextResponse.json({
      ok: true,
      kind: "candidates",
      cards: resolved.cards,
      city: resolved.city,
    });
  }

  return NextResponse.json({ ok: true, kind: "not_found" });
}
