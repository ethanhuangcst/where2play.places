import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { startPlanDiscover } from "@/src/core/plan-start-discover";
import { providersForDestinationText } from "@/src/places-agent/client";
import type { PlanBoundaries } from "@/src/core/itinerary-types";
import { emptyPlanItinerary, upsertPlanSessionCache } from "@/src/core/plan-session-cache";

export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const raw = await request.json().catch(() => ({}));
  const destination = typeof raw.destination === "string" ? raw.destination.trim() : "";
  const startDate = typeof raw.startDate === "string" ? raw.startDate.trim() : "";
  const daysRaw = raw.days;
  const days =
    typeof daysRaw === "number"
      ? daysRaw
      : typeof daysRaw === "string" && daysRaw.trim()
        ? Number(daysRaw)
        : NaN;

  if (!destination || !startDate || !Number.isInteger(days) || days < 1 || days > 14) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(
    typeof raw.locale === "string" ? raw.locale : gate.user.locale,
  );

  const partySize =
    typeof raw.partySize === "number"
      ? raw.partySize
      : typeof raw.partySize === "string"
        ? Number(raw.partySize)
        : undefined;
  const budget = typeof raw.budget === "string" ? raw.budget : undefined;
  const maxNumber =
    typeof raw.max_number === "number"
      ? raw.max_number
      : typeof raw.max_number === "string"
        ? Number(raw.max_number)
        : 5;

  const result = await startPlanDiscover({
    destination,
    startDate,
    days,
    locale,
    providers: providersForDestinationText(destination),
    partySize: Number.isFinite(partySize) ? partySize : undefined,
    budget,
    max_number: Number.isFinite(maxNumber) ? maxNumber : 5,
  });

  if (!result.ok) {
    console.error("plan/discover failed", result.key);
    const status = result.key === "errors.validation" ? 400 : 502;
    return NextResponse.json({ ok: false, error: { key: result.key } }, { status });
  }

  const criteria: PlanBoundaries = {
    destination,
    startDate,
    days,
    locale,
    tripId: result.trip_id,
    revision: result.revision,
    ...(typeof partySize === "number" && Number.isFinite(partySize) ? { partySize } : {}),
    ...(budget ? { budget } : {}),
  };
  await upsertPlanSessionCache(gate.user.id, criteria, emptyPlanItinerary(criteria));

  return NextResponse.json({
    ok: true,
    trip_id: result.trip_id,
    revision: result.revision,
    iconic_places: result.iconic_places,
    pool: result.pool,
  });
}
