import "server-only";

import { ymdPlusDays } from "./plan-agent-body";
import { iconicPlacesFromTravelTips } from "./plan-iconic-parse";
import { artifactsTipsFromSlice, tripFetchSlice } from "./plan-fetch-trip";
import {
  fetchTripDetails,
  providersForDestinationText,
  travelTips,
} from "../places-agent/client";

export { iconicPlacesFromTravelTips } from "./plan-iconic-parse";

/** Destination-agnostic heat rank from discover cards (no city table). */
export function rankIconicFromPool(places: unknown[], limit: number): string[] {
  const cap = Math.max(0, Math.min(limit, 12));
  const scored = (places ?? [])
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const c = raw as { name?: unknown; user_ratings_total?: unknown; rating?: unknown };
      if (typeof c.name !== "string" || !c.name.trim()) return null;
      const heat = typeof c.user_ratings_total === "number" ? c.user_ratings_total : 0;
      const rating = typeof c.rating === "number" ? c.rating : 0;
      return { name: c.name.trim(), heat, rating };
    })
    .filter((x): x is { name: string; heat: number; rating: number } => x != null);
  scored.sort((a, b) => b.heat - a.heat || b.rating - a.rating || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of scored) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    out.push(s.name);
    if (out.length >= cap) break;
  }
  return out;
}

export type FetchIconicPlacesForPlanInput = {
  destination: string;
  startDate: string;
  days: number;
  locale: string;
  providers?: string[];
  tripId?: string;
  revision?: number;
};

/**
 * Write `travel_tips` then read `artifacts` via fetch_trip_details (F75/F76).
 */
export async function fetchIconicPlacesForPlan(
  input: FetchIconicPlacesForPlanInput,
): Promise<string[]> {
  const destination = input.destination.trim();
  const startDate = input.startDate.trim();
  const days = input.days;
  if (!destination || !startDate || !Number.isInteger(days) || days < 1 || days > 14) {
    return [];
  }
  const end = ymdPlusDays(startDate, Math.max(0, days - 1));
  const providers = input.providers ?? providersForDestinationText(destination);
  const written = await travelTips({
    destination,
    bounds: { start: startDate, end },
    locale: input.locale,
    providers,
    ...(input.tripId ? { trip_id: input.tripId } : {}),
    ...(typeof input.revision === "number" ? { revision: input.revision } : {}),
  });
  if (!written.ok || !written.data) return [];
  const tripId =
    typeof written.data.trip_id === "string" ? written.data.trip_id : input.tripId;
  if (!tripId) {
    return iconicPlacesFromTravelTips(written.data);
  }
  const fetched = await fetchTripDetails({
    trip_id: tripId,
    fields: ["artifacts"],
    locale: input.locale,
  });
  if (!fetched.ok) return iconicPlacesFromTravelTips(written.data);
  const { slice } = tripFetchSlice(fetched);
  const tips = artifactsTipsFromSlice(slice);
  if (tips) return iconicPlacesFromTravelTips(tips);
  return iconicPlacesFromTravelTips(slice);
}
