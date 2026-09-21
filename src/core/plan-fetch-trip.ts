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

export type ArtifactsVisa = {
  passport: string;
  destination: string;
  requirement?: string;
  visa_free_days?: number | null;
  description?: string;
  documents?: string[];
  process?: string[];
  processing_time?: string;
  cost?: string;
  validity?: string;
  max_stay?: string;
  embassy?: string;
  transit_visa?: string;
  extension?: { possible: boolean; details?: string };
  last_verified?: string;
  source_url?: string;
};

function isUpgradePlaceholder(value: unknown): boolean {
  return (
    value != null &&
    typeof value === "object" &&
    "upgrade" in value &&
    typeof (value as { upgrade?: unknown }).upgrade === "string"
  );
}

function looksLikeUpgradeCopy(value: string): boolean {
  return /upgrade|requires pro|starter plan|pro plan/i.test(value);
}

function honestString(value: unknown): string | undefined {
  if (isUpgradePlaceholder(value)) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text || looksLikeUpgradeCopy(text)) return undefined;
  return text;
}

function honestStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => honestString(item)).filter((item): item is string => Boolean(item));
  return items.length ? items : undefined;
}

function honestHttpUrl(value: unknown): string | undefined {
  const text = honestString(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") return text;
  } catch {
    return undefined;
  }
  return undefined;
}

function honestExtension(value: unknown): { possible: boolean; details?: string } | undefined {
  if (!value || typeof value !== "object" || isUpgradePlaceholder(value)) return undefined;
  const rec = value as { possible?: unknown; details?: unknown };
  if (typeof rec.possible !== "boolean") return undefined;
  const details = honestString(rec.details);
  return details ? { possible: rec.possible, details } : { possible: rec.possible };
}

/** Displayable visa from fetch artifacts (ADR-046). Hide unavailable / adapter error outcomes (94c). */
export function artifactsVisaFromSlice(slice: Record<string, unknown>): ArtifactsVisa | null {
  const artifacts = slice.artifacts;
  if (!artifacts || typeof artifacts !== "object") return null;
  const visa = (artifacts as { visa?: unknown }).visa;
  if (!visa || typeof visa !== "object") return null;
  const rec = visa as Record<string, unknown>;
  if (rec.unavailable === true) return null;
  if (typeof rec.outcome === "string" && rec.outcome.startsWith("errors.")) return null;
  const passport = typeof rec.passport === "string" ? rec.passport.trim().toUpperCase() : "";
  const destination = typeof rec.destination === "string" ? rec.destination.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(passport) || !/^[A-Z]{3}$/.test(destination)) return null;
  // 107: same ISO / Orizn not_applicable — not a displayable overseas visa.
  const requirement =
    typeof rec.requirement === "string" && rec.requirement.trim()
      ? rec.requirement.trim()
      : undefined;
  if (requirement === "not_applicable" || passport === destination) return null;
  const documents = honestStringList(rec.documents);
  const process = honestStringList(rec.process);
  const extension = honestExtension(rec.extension);
  const sourceUrl = honestHttpUrl(rec.source_url);
  const description = honestString(rec.description);
  const processingTime = honestString(rec.processing_time);
  const cost = honestString(rec.cost);
  const validity = honestString(rec.validity);
  const maxStay = honestString(rec.max_stay);
  const embassy = honestString(rec.embassy);
  const transitVisa = honestString(rec.transit_visa);
  const lastVerified = honestString(rec.last_verified) ?? honestString(rec.last_verified_at);
  return {
    passport,
    destination,
    ...(requirement ? { requirement } : {}),
    ...(typeof rec.visa_free_days === "number" || rec.visa_free_days === null
      ? { visa_free_days: rec.visa_free_days as number | null }
      : {}),
    ...(description ? { description } : {}),
    ...(documents ? { documents } : {}),
    ...(process ? { process } : {}),
    ...(processingTime ? { processing_time: processingTime } : {}),
    ...(cost ? { cost } : {}),
    ...(validity ? { validity } : {}),
    ...(maxStay ? { max_stay: maxStay } : {}),
    ...(embassy ? { embassy } : {}),
    ...(transitVisa ? { transit_visa: transitVisa } : {}),
    ...(extension ? { extension } : {}),
    ...(lastVerified ? { last_verified: lastVerified } : {}),
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
  };
}

export type VisaNotice = { key: string; href?: string };

/** i18n key when a visa write failed closed. Not a policy result. */
export const VISA_NOTICE_UNAVAILABLE = "play.plan.travel_tips_visa_unavailable";

/**
 * Honest degrade (94c): quota / vendor failure stored as unavailable or `errors.*`.
 * Returns null when a displayable visa exists, or when the slice has no visa write.
 */
export function visaNoticeFromSlice(slice: Record<string, unknown>): VisaNotice | null {
  if (artifactsVisaFromSlice(slice)) return null;
  const artifacts = slice.artifacts;
  if (!artifacts || typeof artifacts !== "object") return null;
  const visa = (artifacts as { visa?: unknown }).visa;
  if (!visa || typeof visa !== "object") return null;
  const rec = visa as Record<string, unknown>;
  const outcome = typeof rec.outcome === "string" ? rec.outcome : "";
  if (outcome.startsWith("errors.") || rec.unavailable === true) {
    return { key: VISA_NOTICE_UNAVAILABLE };
  }
  return null;
}

/** Tips card payload: artifacts.tips plus display visa or a degrade notice. Null if none exist. */
export function travelTipsPayloadFromSlice(slice: Record<string, unknown>): Record<string, unknown> | null {
  const tips = artifactsTipsFromSlice(slice);
  const visa = artifactsVisaFromSlice(slice);
  const visaNotice = visa ? null : visaNoticeFromSlice(slice);
  if (!tips && !visa && !visaNotice) return null;
  return {
    ...(tips ?? {}),
    ...(visa ? { visa } : {}),
    ...(visaNotice ? { visa_notice: visaNotice } : {}),
  };
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
