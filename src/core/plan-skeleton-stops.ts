import type { ItinerarySlot } from "./itinerary-types";

export type SkeletonStopRow = {
  name: string;
  kind?: string;
  mealSlot?: string;
  filled?: boolean;
  pending?: boolean;
};

export type SkeletonDayRow = {
  dayIndex: number;
  theme?: string;
  stops: SkeletonStopRow[];
};

export function skeletonStopsForFocusedDay(
  skeletonDays: SkeletonDayRow[],
  focusDayIndex: number | null,
  liveSlots: ItinerarySlot[],
  planSubPhase: "discovering" | "skeleton" | "filling" | "idle",
): SkeletonStopRow[] {
  const dayIndex = focusDayIndex ?? skeletonDays[0]?.dayIndex ?? 1;
  const day = skeletonDays.find((d) => d.dayIndex === dayIndex);
  if (!day?.stops.length) return [];

  const filledPlaceCount = liveSlots.filter((s) => s.kind === "place").length;

  if (planSubPhase === "filling") {
    return day.stops.map((stop, i) => ({
      ...stop,
      filled: i < filledPlaceCount,
      pending: i === filledPlaceCount,
    }));
  }

  if (planSubPhase === "skeleton") {
    return day.stops.map((stop, i) => ({
      ...stop,
      filled: false,
      pending: i === 0,
    }));
  }

  return day.stops.map((stop) => ({ ...stop, filled: false, pending: false }));
}
