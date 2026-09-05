/** Destination-bounded origin lookup (ADR-048 / S7). No hotel-name-only geocode. */

import {
  isBrandOnlyOriginQuery,
  originNameTokensCovered,
  originSearchQuery,
  pickAutoMatchingOrigin,
} from "./plan-origin-name-match";

/** Google Places circle bias max is 50km; 80km haversine still applied after search. */
export const ORIGIN_SEARCH_BIAS_M = 50_000;

export const ORIGIN_NEAR_CITY_KM = 80;
export const ORIGIN_RETRY_CHIP = "__origin_retry__";
export const ORIGIN_PICK_PREFIX = "__origin_pick__:";
export const ORIGIN_CANDIDATE_LIMIT = 3;

export type OriginCard = {
  name: string;
  location?: { lat?: number; lng?: number };
};

export type ResolveOriginResult =
  | { kind: "skip"; lat: number; lng: number }
  | { kind: "hit"; name: string; lat: number; lng: number }
  | { kind: "not_found" }
  | { kind: "candidates"; cards: OriginCard[]; city: { lat: number; lng: number } };

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Prefer named cards with coords within maxKm of city.
 * S6A/S7: cards without lat/lng never count as in-city hits.
 */
export function pickOriginCardNearCity(
  cards: OriginCard[],
  city: { lat: number; lng: number } | null,
  maxKm = ORIGIN_NEAR_CITY_KM,
): OriginCard | null {
  const near = filterOriginCardsNearCity(cards, city, maxKm);
  return near[0] ?? null;
}

export function filterOriginCardsNearCity(
  cards: OriginCard[],
  city: { lat: number; lng: number } | null,
  maxKm = ORIGIN_NEAR_CITY_KM,
): OriginCard[] {
  const named = cards.filter((c) => typeof c.name === "string" && c.name.trim());
  if (!named.length || !city) return [];
  return named.filter((c) => {
    const lat = c.location?.lat;
    const lng = c.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    return haversineKm(city, { lat, lng }) <= maxKm;
  });
}

export function originPickChipValue(index: number): string {
  return `${ORIGIN_PICK_PREFIX}${index}`;
}

export function parseOriginPickIndex(value: string): number | null {
  if (!value.startsWith(ORIGIN_PICK_PREFIX)) return null;
  const n = Number(value.slice(ORIGIN_PICK_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Chip tokens must never appear as hotel / stay names. */
export function sanitizeDailyStartName(name: string | undefined | null): string {
  const n = (name ?? "").trim();
  if (!n || parseOriginPickIndex(n) != null) return "";
  return n;
}

/** Resolve A/B/C chip to the candidate hotel name. */
export function originNameFromPick(
  value: string,
  cards: Array<{ name: string }>,
): string {
  const idx = parseOriginPickIndex(value.trim());
  if (idx == null) return sanitizeDailyStartName(value);
  return cards[idx]?.name?.trim() ?? "";
}

export type ResolveOriginDeps = {
  searchPlaces: (input: {
    query: string;
    address?: string;
    near?: { lat: number; lng: number };
    locale: string;
    providers?: string[];
    bias_radius_m?: number;
  }) => Promise<{ ok: boolean; data?: OriginCard[] | { data?: OriginCard[] } }>;
  geocode: (input: {
    query: string;
    locale: string;
    providers?: string[];
  }) => Promise<{ ok: boolean; data?: { lat: number; lng: number } | null }>;
  /** After city geocode — do not use CJK-text AMAP routing for Lisbon. */
  providersForPin?: (lat: number, lng: number) => string[];
};

function cardsFromSearch(data: unknown): OriginCard[] {
  if (Array.isArray(data)) return data as OriginCard[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: OriginCard[] }).data;
  }
  return [];
}

function hitFromCard(hit: OriginCard): ResolveOriginResult {
  const lat = hit.location?.lat;
  const lng = hit.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return { kind: "not_found" };
  return { kind: "hit", name: hit.name.trim(), lat, lng };
}

async function geocodeCity(
  destination: string,
  locale: string,
  providers: string[] | undefined,
  geocode: ResolveOriginDeps["geocode"],
): Promise<{ lat: number; lng: number } | null> {
  try {
    const geo = await geocode({ query: destination, locale, providers });
    if (geo.ok && geo.data && geo.data.lat != null && geo.data.lng != null) {
      return { lat: geo.data.lat, lng: geo.data.lng };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * S7: resolve intake origin.
 * - empty query → skip with destination coords
 * - pick index → hit from prior candidates (caller supplies pick via resolveOriginPick)
 * - unique exact name match auto → hit
 * - brand-only (凯悦) or remapped / multiple nearby → candidates (≤3)
 * - else not_found
 */
export async function resolvePlanOrigin(
  input: {
    query: string;
    destination: string;
    locale: string;
    providers?: string[];
  },
  deps: ResolveOriginDeps,
): Promise<ResolveOriginResult> {
  const dest = input.destination.trim();
  if (!dest) return { kind: "not_found" };

  const city = await geocodeCity(dest, input.locale, input.providers, deps.geocode);
  if (!city) return { kind: "not_found" };

  const q = input.query.trim();
  if (!q) return { kind: "skip", lat: city.lat, lng: city.lng };

  const pinProviders = deps.providersForPin?.(city.lat, city.lng) ?? input.providers;

  try {
    const res = await deps.searchPlaces({
      query: originSearchQuery(q),
      address: dest,
      near: city,
      locale: input.locale,
      providers: pinProviders,
      bias_radius_m: ORIGIN_SEARCH_BIAS_M,
    });
    if (!res.ok) return { kind: "not_found" };
    const near = filterOriginCardsNearCity(cardsFromSearch(res.data), city).slice(
      0,
      ORIGIN_CANDIDATE_LIMIT,
    );
    if (!near.length) return { kind: "not_found" };

    if (!isBrandOnlyOriginQuery(q)) {
      const auto = pickAutoMatchingOrigin(q, near);
      if (auto) return hitFromCard(auto);
    }

    return { kind: "candidates", cards: near, city };
  } catch {
    return { kind: "not_found" };
  }
}

export function resolveOriginPick(
  cards: OriginCard[],
  index: number,
): ResolveOriginResult {
  const card = cards[index];
  if (!card) return { kind: "not_found" };
  return hitFromCard(card);
}

export { originNameTokensCovered };
