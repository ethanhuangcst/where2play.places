export const INTEREST_IDS = [
  "tourist_attraction",
  "restaurant",
  "museum",
  "park",
  "place_of_worship",
  "night_market",
  "shopping_mall",
  "spa",
  "natural_feature",
] as const;

export type InterestId = (typeof INTEREST_IDS)[number];

export const INTEREST_LABEL_KEYS: Record<InterestId, string> = {
  tourist_attraction: "play.interest.tourist_attraction",
  restaurant: "play.interest.restaurant",
  museum: "play.interest.museum",
  park: "play.interest.park",
  place_of_worship: "play.interest.place_of_worship",
  night_market: "play.interest.night_market",
  shopping_mall: "play.interest.shopping_mall",
  spa: "play.interest.spa",
  natural_feature: "play.interest.natural_feature",
};

const INTEREST_SET = new Set<string>(INTEREST_IDS);

export function isInterestId(value: string): value is InterestId {
  return INTEREST_SET.has(value);
}

/** Keep only known interest ids; preserve first-seen order; drop duplicates. */
export function normalizeInterests(raw: unknown): InterestId[] {
  if (!Array.isArray(raw)) return [];
  const out: InterestId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !isInterestId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function interestOptions(): { id: InterestId; labelKey: string }[] {
  return INTEREST_IDS.map((id) => ({ id, labelKey: INTEREST_LABEL_KEYS[id] }));
}
