import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { fetchTripCandidates } from "@/src/core/plan-fetch-candidates";
import { listDestinationPois } from "@/src/places-agent/client";

/** Debug: registry POIs vs trip.candidates (intake slice). */
export async function GET(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const tripId = request.nextUrl.searchParams.get("trip_id")?.trim() ?? "";
  const locale = normalizeLocale(
    request.nextUrl.searchParams.get("locale") ?? gate.user.locale,
  );

  if (!city && !tripId) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  let registry: Array<{ name: string; kind?: string; provider?: string }> = [];
  let registryCount = 0;
  if (city) {
    const listed = await listDestinationPois({ city, locale });
    if (listed.ok && listed.data) {
      registry = listed.data.places ?? [];
      registryCount = listed.data.count ?? registry.length;
    }
  }

  let tripPool: Array<{ name: string; kind?: string; provider?: string }> = [];
  if (tripId) {
    const result = await fetchTripCandidates({
      trip_id: tripId,
      locale,
      max_number: 80,
    });
    if (result.ok) {
      tripPool = (result.pool ?? []).map((row) => ({
        name: row.name,
        kind: row.kind,
        provider: row.provider,
      }));
    }
  }

  return NextResponse.json({
    ok: true,
    city,
    trip_id: tripId || undefined,
    registry_count: registryCount,
    trip_candidates_count: tripPool.length,
    registry,
    trip_candidates: tripPool,
  });
}
