/** Ordered unique names from artifacts.tips or travel_tips.iconic_places. */
export function iconicPlacesFromTravelTips(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const rec = data as { iconic_places?: unknown; tips?: { iconic_places?: unknown } };
  const nested = rec.tips && typeof rec.tips === "object" ? rec.tips.iconic_places : undefined;
  const raw = Array.isArray(nested) ? nested : rec.iconic_places;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Same cap as agent `iconicLimitForTripDays` (ADR-042: no city table). */
export function iconicLimitForTripDays(numDays?: number): number {
  const days = Math.max(1, numDays ?? 3);
  return Math.min(12, Math.max(3, days + 2));
}

/** Grounded must-see chips from fetch `candidates` (must_see flags only), heat order. */
export function mustSeeNamesFromCandidates(
  slice: Record<string, unknown>,
  numDays?: number,
  limit?: number,
): string[] {
  const cap = limit ?? iconicLimitForTripDays(numDays);
  const rawCand = slice.candidates;
  const placesRaw =
    rawCand && typeof rawCand === "object"
      ? (rawCand as { places?: unknown }).places
      : (slice as { places?: unknown }).places;
  const places = Array.isArray(placesRaw) ? placesRaw : [];
  const mustSee = places.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const c = item as { name?: unknown; must_see?: unknown };
    return c.must_see === true && typeof c.name === "string" && c.name.trim().length > 0;
  }) as Array<{ name: string; user_ratings_total?: number; rating?: number }>;

  mustSee.sort((a, b) => {
    const heat = (c: { user_ratings_total?: number; rating?: number }) => {
      if (typeof c.user_ratings_total === "number" && c.user_ratings_total > 0) {
        return c.user_ratings_total;
      }
      if (typeof c.rating === "number" && c.rating > 0) return c.rating * 1000;
      return 0;
    };
    const diff = heat(b) - heat(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of mustSee) {
    const name = c.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= cap) break;
  }
  return out;
}
