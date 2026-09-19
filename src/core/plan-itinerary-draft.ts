import type { ItineraryDto } from "./itinerary-types";

/** Plan board has at least one filled place slot (ADR-073 draft). Client-safe — no server imports. */
export function itineraryHasFilledPlaceSlots(it: ItineraryDto | null | undefined): boolean {
  if (!it) return false;
  return it.days.some((d) => d.slots.some((s) => s.kind === "place"));
}
