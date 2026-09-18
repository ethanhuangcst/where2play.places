import type { ItineraryDayDto, ItineraryDto, ItineraryPlaceSlot } from "./itinerary-types";
import { asAgentSkeleton } from "./plan-t3-hydrate";
import { skeletonDayHighlights } from "./itinerary-skeleton-map";

/** Merge agent refine skeleton into existing itinerary (preserve matching place slots). */
export function mergeRefineSkeletonIntoItinerary(
  current: ItineraryDto,
  skeletonRaw: unknown,
  t: (key: string, vars?: Record<string, string>) => string,
): ItineraryDto {
  const skeleton = asAgentSkeleton(skeletonRaw);
  if (!skeleton) return current;

  const days: ItineraryDayDto[] = skeleton.days.map((skDay) => {
    const existingDay = current.days.find((d) => d.dayIndex === skDay.day_index);
    const skNames = new Set((skDay.stops ?? []).map((s) => s.name.trim()).filter(Boolean));

    const keptSlots = (existingDay?.slots ?? []).filter((slot) => {
      if (slot.kind !== "place") return false;
      return skNames.has(slot.name.trim());
    });

    const keptNames = new Set(
      keptSlots
        .filter((s): s is ItineraryPlaceSlot => s.kind === "place")
        .map((s) => s.name.trim()),
    );

    for (const stop of skDay.stops ?? []) {
      const name = stop.name?.trim();
      if (!name || keptNames.has(name)) continue;
      if (stop.kind === "meal" || stop.meal_slot) continue;
      keptSlots.push({
        kind: "place",
        start: "—",
        end: "—",
        placeKind: stop.kind === "stay" ? "Stay" : "Attraction",
        name,
        summary: "",
      });
    }

    return {
      dayIndex: skDay.day_index,
      highlights:
        existingDay?.highlights ??
        skeletonDayHighlights(skDay.day_index, skDay.day_theme, t),
      slots: keptSlots,
    };
  });

  return {
    ...current,
    days,
    daysCount: days.length,
    updatedAt: new Date().toISOString(),
  };
}
