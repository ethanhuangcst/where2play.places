export type DiscoverPoolRow = {
  name: string;
  heat: number | null;
  must_see: boolean;
  kind: "place" | "restaurant";
};

function asCardList(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : [];
}

export function discoverPoolRowsFromSlice(slice: Record<string, unknown>): DiscoverPoolRow[] {
  const cand = slice.candidates && typeof slice.candidates === "object" ? (slice.candidates as Record<string, unknown>) : slice;
  const places = asCardList(cand.places);
  const restaurants = asCardList(cand.restaurants);
  const row = (item: Record<string, unknown>, kind: "place" | "restaurant"): DiscoverPoolRow | null => {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) return null;
    const heat =
      typeof item.user_ratings_total === "number"
        ? item.user_ratings_total
        : typeof item.rating === "number"
          ? item.rating
          : null;
    return { name, heat, must_see: item.must_see === true, kind };
  };
  return [
    ...places.map((p) => row(p, "place")),
    ...restaurants.map((r) => row(r, "restaurant")),
  ].filter((x): x is DiscoverPoolRow => x != null);
}
