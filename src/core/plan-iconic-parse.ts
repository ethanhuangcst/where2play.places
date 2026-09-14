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

/**
 * Iconic / must-see chip names from trip slice (ADR-069).
 * Prefer `artifacts.tips.iconic_places`; fall back to travel_tips / tips.
 * Does not read PlaceCard.must_see flags.
 */
export function mustSeeNamesFromCandidates(
  slice: Record<string, unknown>,
  numDays?: number,
  limit?: number,
): string[] {
  const cap = limit ?? iconicLimitForTripDays(numDays);

  const fromArtifacts = iconicPlacesFromTravelTips(slice.artifacts);
  if (fromArtifacts.length > 0) return fromArtifacts.slice(0, cap);

  const fromTravelTips = iconicPlacesFromTravelTips(slice.travel_tips);
  if (fromTravelTips.length > 0) return fromTravelTips.slice(0, cap);

  const fromTips = iconicPlacesFromTravelTips(slice.tips);
  if (fromTips.length > 0) return fromTips.slice(0, cap);

  // Slice may already be the tips / artifacts.tips object.
  return iconicPlacesFromTravelTips(slice).slice(0, cap);
}
