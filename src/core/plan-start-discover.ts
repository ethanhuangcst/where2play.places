import "server-only";

import { ymdPlusDays } from "./plan-agent-body";
import { type DiscoverPoolRow } from "./plan-discover-pool";
import { fetchTripCandidates } from "./plan-fetch-candidates";
import { planTrip } from "../places-agent/client";

export type StartPlanDiscoverInput = {
  destination: string;
  startDate: string;
  days: number;
  locale: string;
  partySize?: number;
  budget?: string;
  max_number?: number;
};

export type StartPlanDiscoverResult = {
  ok: true;
  trip_id: string;
  revision?: number;
  iconic_places: string[];
  pool: DiscoverPoolRow[];
} | {
  ok: false;
  key: string;
};

/** Chips/pool via plan_trip + fetch_trip_details (G6/G7). Omit providers[]. */
export async function startPlanDiscover(
  input: StartPlanDiscoverInput,
): Promise<StartPlanDiscoverResult> {
  const destination = input.destination.trim();
  const startDate = input.startDate.trim();
  const days = input.days;
  if (!destination || !startDate || !Number.isInteger(days) || days < 1 || days > 14) {
    return { ok: false, key: "errors.validation" };
  }
  const end = ymdPlusDays(startDate, Math.max(0, days - 1));
  const maxNumber = input.max_number ?? 5;
  const written = await planTrip({
    city: destination,
    bounds: { start: startDate, end },
    locale: input.locale,
    numDays: days,
    ...(input.partySize != null ? { party_size: input.partySize } : {}),
    ...(input.budget ? { budget: input.budget } : {}),
  });
  if (!written.ok || !written.data) {
    console.error("startPlanDiscover: plan_trip not ok", written.outcome?.key);
    return { ok: false, key: written.outcome?.key ?? "errors.discover_places_failed" };
  }
  const tripId =
    typeof written.data.trip_id === "string" ? written.data.trip_id : undefined;
  if (!tripId) {
    return { ok: false, key: "errors.discover_places_failed" };
  }
  const revision =
    typeof written.data.revision === "number" ? written.data.revision : undefined;
  const fetched = await fetchTripCandidates({
    trip_id: tripId,
    locale: input.locale,
    days,
    max_number: maxNumber,
  });
  if (!fetched.ok) {
    return {
      ok: true,
      trip_id: tripId,
      revision,
      iconic_places: [],
      pool: [],
    };
  }
  return {
    ok: true,
    trip_id: tripId,
    revision: fetched.revision ?? revision,
    iconic_places: fetched.iconic_places,
    pool: fetched.pool,
  };
}
