import type { ItineraryDto, PlanBoundaries } from "./itinerary-types";

export type DebugStopRow = {
  name: string;
  kind: "origin" | "place" | "restaurant" | "attraction";
  provider?: string;
};

export function debugOriginRows(
  criteria: PlanBoundaries | null | undefined,
  itinerary: ItineraryDto | null | undefined,
): DebugStopRow[] {
  const rows: DebugStopRow[] = [];
  const seen = new Set<string>();
  const push = (name: string, provider?: string) => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ name: n, kind: "origin", provider });
  };

  const stay = criteria?.originStay;
  if (stay?.name) push(stay.name, stay.provider);
  else if (criteria?.dailyStart?.trim()) push(criteria.dailyStart);

  if (itinerary?.days) {
    for (const day of itinerary.days) {
      for (const slot of day.slots) {
        if (slot.kind !== "place") continue;
        const pk = slot.placeKind?.toLowerCase() ?? "";
        if (pk !== "stay" && pk !== "hotel" && pk !== "origin") continue;
        push(slot.name, slot.provider);
      }
    }
  }
  return rows;
}
