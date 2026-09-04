import type { AgentEnvelope } from "../places-agent/client";

export type TripFetchSlice = {
  trip_id?: string;
  revision?: number;
  slice: Record<string, unknown>;
};

/** Unwrap `fetch_trip_details` envelope (`{ trip_id, revision, data }`). */
export function tripFetchSlice(envelope: AgentEnvelope<unknown>): TripFetchSlice {
  const raw = envelope.data;
  if (!raw || typeof raw !== "object") return { slice: {} };
  const rec = raw as Record<string, unknown>;
  const inner = rec.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return {
      trip_id: typeof rec.trip_id === "string" ? rec.trip_id : undefined,
      revision: typeof rec.revision === "number" ? rec.revision : undefined,
      slice: inner as Record<string, unknown>,
    };
  }
  return {
    trip_id: typeof rec.trip_id === "string" ? rec.trip_id : undefined,
    revision: typeof rec.revision === "number" ? rec.revision : undefined,
    slice: rec,
  };
}

export function candidatesFromSlice(slice: Record<string, unknown>): {
  places: unknown[];
  restaurants: unknown[];
} | null {
  const raw = slice.candidates;
  if (!raw || typeof raw !== "object") return null;
  const places = (raw as { places?: unknown }).places;
  const restaurants = (raw as { restaurants?: unknown }).restaurants;
  if (!Array.isArray(places) && !Array.isArray(restaurants)) return null;
  return {
    places: Array.isArray(places) ? places : [],
    restaurants: Array.isArray(restaurants) ? restaurants : [],
  };
}

export function skeletonIsFillable(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const days = (raw as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length === 0) return false;
  return days.every((day) => {
    if (!day || typeof day !== "object") return false;
    const stops = (day as { stops?: unknown }).stops;
    if (!Array.isArray(stops) || stops.length === 0) return false;
    return stops.some(
      (s) => s && typeof s === "object" && (s as { kind?: string }).kind !== "stay",
    );
  });
}

export function skeletonStopCount(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const days = (raw as { days?: unknown }).days;
  if (!Array.isArray(days)) return 0;
  return days.reduce((n, d) => {
    const stops = d && typeof d === "object" ? (d as { stops?: unknown }).stops : undefined;
    return n + (Array.isArray(stops) ? stops.length : 0);
  }, 0);
}

export function artifactsTipsFromSlice(slice: Record<string, unknown>): Record<string, unknown> | null {
  const artifacts = slice.artifacts;
  if (!artifacts || typeof artifacts !== "object") return null;
  const tips = (artifacts as { tips?: unknown }).tips;
  if (!tips || typeof tips !== "object") return null;
  return tips as Record<string, unknown>;
}
