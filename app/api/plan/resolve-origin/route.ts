import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { geocode, searchPlaces, suggestPlaces } from "@/src/places-agent/client";
import { resolvePlanOrigin } from "@/src/core/plan-resolve-origin";

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
  const resolved = await resolvePlanOrigin(
    {
      query: parsed.data.query,
      destination: parsed.data.destination,
      locale,
    },
    { searchPlaces, suggestPlaces, geocode },
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
      cards: resolved.cards.map((c) => ({
        name: c.name,
        lat: c.location?.lat,
        lng: c.location?.lng,
        provider: c.provider,
        native_id: c.sources?.find((s) => s.native_id?.trim())?.native_id,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    kind: "not_found",
  });
}
