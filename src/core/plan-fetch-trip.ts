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
    return stops.some((s) => {
      if (!s || typeof s !== "object") return false;
      const kind = (s as { kind?: string }).kind;
      return kind === "attraction" || kind === "place";
    });
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

/** Latest stop written to trip.filled (HTTP plan_next_stop overwrites with { stop, slot, legs }). */
export type TripFilledStopSlice = {
  stop?: {
    name?: string;
    kind?: string;
    provider?: string;
    native_id?: string;
    nativeId?: string;
    meal_skipped?: boolean;
    card?: StopDisplayLikeCard | null;
    deeplinks?: Record<string, string>;
  };
  slot?: { start?: string; end?: string };
  legs?: Array<{ mode?: string; duration_min?: number; recommended?: boolean; deeplinks?: Record<string, string> }>;
  day_index?: number;
  stop_index?: number;
};

type StopDisplayLikeCard = {
  provider?: string;
  name?: string;
  photos?: string[];
  sources?: Array<{ provider?: string; native_id?: string; deeplinks?: Record<string, string> }>;
};

/**
 * Unwrap `fetch_trip_details` `filled` field into the latest filled stop.
 * Supports: `{ stop, slot, legs }`, `{ stops: [...] }`, or a raw array.
 */
export function latestFilledStopFromSlice(slice: Record<string, unknown>): TripFilledStopSlice | null {
  const filled = slice.filled;
  if (filled == null) return null;
  if (Array.isArray(filled)) {
    const last = filled[filled.length - 1];
    return last && typeof last === "object" ? (last as TripFilledStopSlice) : null;
  }
  if (typeof filled !== "object") return null;
  const rec = filled as Record<string, unknown>;
  if (Array.isArray(rec.stops) && rec.stops.length > 0) {
    const last = rec.stops[rec.stops.length - 1];
    if (!last || typeof last !== "object") return null;
    const entry = last as Record<string, unknown>;
    if (entry.stop || entry.slot || entry.legs) return last as TripFilledStopSlice;
    return { stop: last as TripFilledStopSlice["stop"] };
  }
  if (rec.stop || rec.slot || Array.isArray(rec.legs)) {
    return {
      stop: rec.stop as TripFilledStopSlice["stop"],
      slot: rec.slot as TripFilledStopSlice["slot"],
      legs: Array.isArray(rec.legs)
        ? (rec.legs as TripFilledStopSlice["legs"])
        : undefined,
      day_index: typeof rec.day_index === "number" ? rec.day_index : undefined,
      stop_index: typeof rec.stop_index === "number" ? rec.stop_index : undefined,
    };
  }
  return null;
}
