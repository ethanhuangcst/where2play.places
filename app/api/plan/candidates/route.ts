import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { fetchTripCandidates } from "@/src/core/plan-fetch-candidates";

/** Fresh fetch_trip_details for step g chips and Story 2 debug dump. */
export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const raw = await request.json().catch(() => ({}));
  const tripId = typeof raw.trip_id === "string" ? raw.trip_id.trim() : "";
  if (!tripId) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }
  const locale = normalizeLocale(
    typeof raw.locale === "string" ? raw.locale : gate.user.locale,
  );
  const days =
    typeof raw.days === "number"
      ? raw.days
      : typeof raw.days === "string"
        ? Number(raw.days)
        : undefined;
  const maxNumber =
    typeof raw.max_number === "number"
      ? raw.max_number
      : typeof raw.max_number === "string"
        ? Number(raw.max_number)
        : 5;

  const result = await fetchTripCandidates({
    trip_id: tripId,
    locale,
    days: Number.isFinite(days) ? days : undefined,
    max_number: Number.isFinite(maxNumber) ? maxNumber : 5,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { key: result.key }, trip_id: tripId }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    trip_id: result.trip_id,
    revision: result.revision,
    iconic_places: result.iconic_places,
    pool: result.pool,
  });
}
