import { isResolvablePlaceNativeId } from "./place-native-id";

export type PlaceDetailsCard = {
  name?: string;
  address?: string;
  photos?: string[];
  rating?: number;
  phone?: string;
  hours?: string;
  category?: string;
  provider?: string;
  sources?: Array<{ provider?: string; native_id?: string }>;
  [key: string]: unknown;
};

type DetailsDeps = {
  getPlaceDetails: (input: {
    provider: string;
    native_id: string;
    locale: string;
  }) => Promise<{ ok: boolean; data?: PlaceDetailsCard | null }>;
  searchPlaces?: (input: {
    query: string;
    locale: string;
    providers?: string[];
    near?: { lat: number; lng: number; crs?: string };
    address?: string;
  }) => Promise<{ ok: boolean; data?: PlaceDetailsCard[] | null }>;
};

function firstHttpPhoto(card: PlaceDetailsCard | null | undefined): string | undefined {
  if (!Array.isArray(card?.photos)) return undefined;
  return card.photos.find((p): p is string => typeof p === "string" && p.startsWith("http"));
}

function nameOverlaps(query: string, name: string | undefined): boolean {
  const q = query.trim();
  const n = (name ?? "").trim();
  if (!q || !n) return false;
  return n.includes(q) || q.includes(n);
}

/**
 * ADR-052: prefer slot provider+native_id details. When AMap tip-only ids return
 * empty (pois:[]), fall back to search by display name so sheet/list can show photos.
 */
export async function resolvePlaceDetailsWithNameFallback(
  input: {
    provider: string;
    nativeId: string;
    locale: string;
    name?: string;
    near?: { lat: number; lng: number; crs?: string };
    city?: string;
  },
  deps: DetailsDeps,
): Promise<{ ok: true; data: PlaceDetailsCard } | { ok: false; key: string }> {
  if (!isResolvablePlaceNativeId(input.provider, input.nativeId)) {
    return { ok: false, key: "errors.invalid_input" };
  }

  const details = await deps.getPlaceDetails({
    provider: input.provider,
    native_id: input.nativeId,
    locale: input.locale,
  });
  if (details.ok && details.data && firstHttpPhoto(details.data)) {
    return { ok: true, data: details.data };
  }

  const q = input.name?.trim();
  if (q && deps.searchPlaces) {
    const search = await deps.searchPlaces({
      query: q,
      locale: input.locale,
      providers: [input.provider],
      ...(input.near ? { near: input.near } : {}),
      ...(input.city?.trim() ? { address: input.city.trim() } : {}),
    });
    const cards = Array.isArray(search.data) ? search.data : [];
    const ranked = cards
      .filter((c) => nameOverlaps(q, c.name))
      .sort((a, b) => {
        const ap = firstHttpPhoto(a) ? 1 : 0;
        const bp = firstHttpPhoto(b) ? 1 : 0;
        if (bp !== ap) return bp - ap;
        const an = (a.name ?? "").trim() === q ? 1 : 0;
        const bn = (b.name ?? "").trim() === q ? 1 : 0;
        return bn - an;
      });
    const hit = ranked.find((c) => firstHttpPhoto(c)) ?? ranked[0];
    if (hit && firstHttpPhoto(hit)) {
      return { ok: true, data: hit };
    }
  }

  if (details.ok && details.data && details.data.name) {
    return { ok: true, data: details.data };
  }

  return { ok: false, key: "errors.place_not_found" };
}
