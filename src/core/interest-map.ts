import { normalizeInterests, type InterestId } from "./interests";

/** Profile and Plan share the same interest id enum (design §3.8). */
export function profileInterestsToPlanInterests(raw: unknown): InterestId[] {
  return normalizeInterests(raw);
}

export function planInterestsToProfileInterests(ids: string[]): InterestId[] {
  return normalizeInterests(ids);
}
