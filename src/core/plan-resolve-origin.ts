/** Destination-bounded origin lookup (ADR-048). No hotel-name-only geocode. */

export const ORIGIN_NEAR_CITY_KM = 80;
export const ORIGIN_RETRY_CHIP = "__origin_retry__";

export type OriginCard = {
  name: string;
  location?: { lat?: number; lng?: number };
};

export type ResolveOriginResult =
  | { kind: "skip" }
  | { kind: "hit"; name: string; lat?: number; lng?: number }
  | { kind: "not_found" }
  | { kind: "degraded"; name: string };

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

export function pickOriginCardNearCity(
  cards: OriginCard[],
  city: { lat: number; lng: number } | null,
  maxKm = ORIGIN_NEAR_CITY_KM,
): OriginCard | null {
  const named = cards.filter((c) => typeof c.name === "string" && c.name.trim());
  if (!named.length) return null;
  if (!city) return named[0] ?? null;
  const near = named.filter((c) => {
    const lat = c.location?.lat;
    const lng = c.location?.lng;
    if (lat == null || lng == null) return true;
    return haversineKm(city, { lat, lng }) <= maxKm;
  });
  return near[0] ?? null;
}

export type ResolveOriginDeps = {
  searchPlaces: (input: {
    query: string;
    address: string;
    locale: string;
    providers?: string[];
  }) => Promise<{ ok: boolean; data?: OriginCard[] | { data?: OriginCard[] } }>;
  geocode: (input: {
    query: string;
    locale: string;
    providers?: string[];
  }) => Promise<{ ok: boolean; data?: { lat: number; lng: number } | null }>;
};

function cardsFromSearch(data: unknown): OriginCard[] {
  if (Array.isArray(data)) return data as OriginCard[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: OriginCard[] }).data;
  }
  return [];
}

export async function resolvePlanOrigin(
  input: {
    query: string;
    destination: string;
    locale: string;
    providers?: string[];
  },
  deps: ResolveOriginDeps,
): Promise<ResolveOriginResult> {
  const q = input.query.trim();
  if (!q) return { kind: "skip" };
  const dest = input.destination.trim();
  if (!dest) return { kind: "degraded", name: q };

  let city: { lat: number; lng: number } | null = null;
  try {
    const geo = await deps.geocode({
      query: dest,
      locale: input.locale,
      providers: input.providers,
    });
    if (geo.ok && geo.data && geo.data.lat != null && geo.data.lng != null) {
      city = { lat: geo.data.lat, lng: geo.data.lng };
    }
  } catch {
    city = null;
  }

  try {
    const res = await deps.searchPlaces({
      query: q,
      address: dest,
      locale: input.locale,
      providers: input.providers,
    });
    if (!res.ok) return { kind: "degraded", name: q };
    const hit = pickOriginCardNearCity(cardsFromSearch(res.data), city);
    if (!hit) return { kind: "not_found" };
    const lat = hit.location?.lat;
    const lng = hit.location?.lng;
    return {
      kind: "hit",
      name: hit.name.trim(),
      ...(lat != null && lng != null ? { lat, lng } : {}),
    };
  } catch {
    return { kind: "degraded", name: q };
  }
}
