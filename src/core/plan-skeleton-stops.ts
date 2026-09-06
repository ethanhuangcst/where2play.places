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
  opts?: { committedPlaceCount?: number },
): SkeletonStopRow[] {
  const dayIndex = focusDayIndex ?? skeletonDays[0]?.dayIndex ?? 1;
  const day = skeletonDays.find((d) => d.dayIndex === dayIndex);
  if (!day?.stops.length) return [];

  const filledPlaceCount = liveSlots.filter((s) => s.kind === "place").length;

  if (planSubPhase === "filling") {
    // day_done cleared liveSlots but itinerary day already has places — no day-bottom outline
    if (filledPlaceCount === 0 && (opts?.committedPlaceCount ?? 0) > 0) {
      return [];
    }
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

  // idle / done: no day-bottom skeleton list (24-P0-ui-C)
  return [];
}

/** After plan_next_stop resolves a venue, write its name onto the skeleton row (meals → restaurant). */
export function patchSkeletonStopName(
  days: SkeletonDayRow[],
  dayIndex: number,
  stopIndex: number,
  name: string,
): SkeletonDayRow[] {
  const trimmed = name.trim();
  if (!trimmed) return days;
  return days.map((day) => {
    if (day.dayIndex !== dayIndex) return day;
    if (stopIndex < 0 || stopIndex >= day.stops.length) return day;
    return {
      ...day,
      stops: day.stops.map((s, i) =>
        i === stopIndex ? { ...s, name: trimmed, filled: true } : s,
      ),
    };
  });
}
