export type SkeletonPreviewStop = {
  name: string;
  kind?: string;
  mealSlot?: string;
  filled?: boolean;
  pending?: boolean;
};

export type SkeletonPreviewDayIn = {
  dayIndex: number;
  theme?: string;
  stops: SkeletonPreviewStop[];
};

/** Collapse repeated hotel stay; keep day_theme once as theme only. */
export function collapseSkeletonPreviewDays(days: SkeletonPreviewDayIn[]): SkeletonPreviewDayIn[] {
  const stayNames = days
    .map((d) => d.stops.find((s) => s.kind === "stay")?.name)
    .filter((n): n is string => Boolean(n));
  const hotel = modeString(stayNames);
  return days.map((day) => {
    const theme = day.theme?.trim() || undefined;
    let stops = day.stops.map((s) => ({ ...s }));
    if (hotel && stops[0]?.kind === "stay" && stops[0].name === hotel) {
      stops = [
        { name: hotel, kind: "stay_origin" },
        ...stops.slice(1),
      ];
    }
    return { ...day, theme, stops };
  });
}

function modeString(items: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: string | undefined;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return n >= 2 ? best : undefined;
}
