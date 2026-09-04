import "server-only";

import { fetchTripDetails } from "../places-agent/client";
import { tripFetchSlice } from "./plan-fetch-trip";
import { discoverPoolRowsFromSlice, type DiscoverPoolRow } from "./plan-discover-pool";
import { mustSeeNamesFromCandidates } from "./plan-iconic-parse";

export type FetchTripCandidatesResult = {
  ok: true;
  trip_id: string;
  revision?: number;
  iconic_places: string[];
  pool: DiscoverPoolRow[];
} | {
  ok: false;
  key: string;
  trip_id?: string;
};

/** Read Trip candidates via fetch_trip_details (F41 S2 step g + debug dump). */
export async function fetchTripCandidates(input: {
  trip_id: string;
  locale: string;
  days?: number;
  max_number?: number;
}): Promise<FetchTripCandidatesResult> {
  const tripId = input.trip_id.trim();
  if (!tripId) return { ok: false, key: "errors.validation" };
  const maxNumber = input.max_number ?? 5;
  const fetched = await fetchTripDetails({
    trip_id: tripId,
    fields: ["candidates"],
    locale: input.locale,
  });
  if (!fetched.ok) {
    return { ok: false, key: fetched.outcome?.key ?? "errors.empty_results", trip_id: tripId };
  }
  const { slice, revision } = tripFetchSlice(fetched);
  return {
    ok: true,
    trip_id: tripId,
    revision: typeof revision === "number" ? revision : undefined,
    iconic_places: mustSeeNamesFromCandidates(slice, input.days, maxNumber),
    pool: discoverPoolRowsFromSlice(slice),
  };
}
