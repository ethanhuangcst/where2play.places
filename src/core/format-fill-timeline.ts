import type { ItineraryDayDto, ItineraryDto, ItineraryPlaceSlot, ItineraryTransitSlot } from "./itinerary-types";
import { planStopKindLabel } from "./plan-slot-preview";
import { mealSlotLabelKey, skeletonStopLabel } from "./meal-slot-label";

type T = (key: string, vars?: Record<string, string>) => string;

export type FillRouteMode = {
  label: string;
  duration: string;
  recommended?: boolean;
};

export type FillRouteLeg =
  | { kind: "origin"; idx: string; name: string }
  | {
      kind: "stop" | "meal";
      idx: string;
      kindLabel: string;
      name: string;
      arrive?: string;
      dwellMin?: number;
    }
  | { kind: "transit"; depart: string; modes: FillRouteMode[] };

export type FillRouteDay = {
  dayIndex: number;
  theme: string;
  legs: FillRouteLeg[];
};

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function dwellMinutes(start: string, end: string): number {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a == null || b == null) return 0;
  const d = b - a;
  return d >= 0 ? d : d + 24 * 60;
}

export function stripOriginPrefix(name: string, t: T): string {
  const trimmed = name.trim();
  const cnDot = "起点 · ";
  if (trimmed.startsWith(cnDot)) return trimmed.slice(cnDot.length).trim();
  const en = "Origin · ";
  if (trimmed.startsWith(en)) return trimmed.slice(en.length).trim();
  const localized = t("play.plan.origin_stop", { name: "\u0000" });
  const prefix = localized.replace("\u0000", "");
  if (prefix && trimmed.startsWith(prefix)) return trimmed.slice(prefix.length).trim();
  return trimmed;
}

/** Parse joined transit.text into mode chips (best-effort). */
export function parseTransitModes(text: string, t: T): FillRouteMode[] {
  const raw = text.trim();
  if (!raw) return [];
  const or = t("play.plan.transit.or");
  const join = t("play.plan.transit.options_join", { or });
  const parts = raw
    .split(join)
    .flatMap((p) => p.split(/，\s*或\s+|,\s*or\s+/i))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((part, i) => {
    const m =
      part.match(/^(.+?)\s*·\s*(?:约\s*)?(\d+)\s*(?:分钟|min|mins?)?/i) ??
      part.match(/^(.+?)\s+(\d+)\s*′/);
    if (m) {
      return {
        label: m[1]!.trim(),
        duration: `${m[2]}′`,
        recommended: i === 0,
      };
    }
    return { label: part, duration: "", recommended: i === 0 };
  });
}

function isMealPlace(place: ItineraryPlaceSlot): boolean {
  const k = (place.placeKind ?? "").toLowerCase();
  return k === "meal" || k === "food" || k === "restaurant" || k === "lunch" || k === "dinner";
}

/**
 * Build one day's route-spine legs from filled itinerary slots.
 * @param includeTransit when false, omit transit legs and arrive/dwell (skeleton).
 */
export function buildDayFillRoute(
  day: ItineraryDayDto,
  t: T,
  opts?: { includeTransit?: boolean },
): FillRouteDay {
  const includeTransit = opts?.includeTransit !== false;
  const theme =
    day.highlights?.theme?.trim() ||
    day.highlights?.title?.trim() ||
    `Day ${day.dayIndex}`;
  const legs: FillRouteLeg[] = [];
  let placeOrdinal = 0;

  for (let i = 0; i < day.slots.length; i++) {
    const slot = day.slots[i]!;
    if (slot.kind === "transit") continue;

    const place = slot as ItineraryPlaceSlot;
    const idx = String(placeOrdinal).padStart(2, "0");
    const isOrigin = place.placeKind === "stay" && placeOrdinal === 0;

    if (isOrigin) {
      legs.push({
        kind: "origin",
        idx,
        name: stripOriginPrefix(place.name, t) || place.name,
      });
      placeOrdinal += 1;
      continue;
    }

    if (includeTransit) {
      const prev = i > 0 ? day.slots[i - 1] : null;
      const transit = prev?.kind === "transit" ? (prev as ItineraryTransitSlot) : null;
      if (transit) {
        legs.push({
          kind: "transit",
          depart: transit.start || place.start || "",
          modes: parseTransitModes(transit.text, t),
        });
      }
    }

    const meal = isMealPlace(place);
    const kindLabel = planStopKindLabel(place.placeKind, t, place.mealSlot);
    legs.push({
      kind: meal ? "meal" : "stop",
      idx,
      kindLabel,
      name: place.name,
      ...(includeTransit
        ? {
            arrive: place.start,
            dwellMin: dwellMinutes(place.start, place.end),
          }
        : {}),
    });
    placeOrdinal += 1;
  }

  return { dayIndex: day.dayIndex, theme, legs };
}

export function buildFillRouteDays(
  itinerary: ItineraryDto | { days: ItineraryDayDto[] },
  t: T,
  opts?: { includeTransit?: boolean },
): FillRouteDay[] {
  const out: FillRouteDay[] = [];
  for (const day of itinerary.days ?? []) {
    if (!day.slots?.some((s) => s.kind === "place")) continue;
    out.push(buildDayFillRoute(day, t, opts));
  }
  return out;
}

export type SkeletonPreviewStop = {
  name: string;
  kind?: string;
  mealSlot?: string;
  meal_slot?: string;
  filled?: boolean;
  pending?: boolean;
};

export type SkeletonPreviewDay = {
  dayIndex: number;
  theme?: string;
  stops: SkeletonPreviewStop[];
};

/** Skeleton preview → route-spine (stops only, no transit / times). */
export function buildSkeletonRouteDays(
  days: SkeletonPreviewDay[],
  t: T,
): FillRouteDay[] {
  return days.map((day) => {
    const legs: FillRouteLeg[] = [];
    day.stops.forEach((stop, i) => {
      const idx = String(i).padStart(2, "0");
      const mealSlot = stop.mealSlot ?? stop.meal_slot;
      const name = skeletonStopLabel(stop, t);
      const isOrigin = stop.kind === "stay" || stop.kind === "stay_origin";

      if (isOrigin) {
        legs.push({
          kind: "origin",
          idx,
          name: stripOriginPrefix(name, t) || name,
        });
        return;
      }

      const mealKey = mealSlotLabelKey(mealSlot) ?? mealSlotLabelKey(stop.name);
      if (mealKey || stop.kind === "meal") {
        legs.push({
          kind: "meal",
          idx,
          kindLabel: mealKey ? t(mealKey) : t("play.plan.meal_slot_lunch"),
          name,
        });
        return;
      }

      legs.push({
        kind: "stop",
        idx,
        kindLabel: t("play.plan.kind_attraction"),
        name,
      });
    });
    return {
      dayIndex: day.dayIndex,
      theme: day.theme?.trim() || `Day ${day.dayIndex}`,
      legs,
    };
  });
}

/** @deprecated Prefer buildFillRouteDays — kept for transitional tests. */
export function formatDayFillTimeline(day: ItineraryDayDto, t: T): string[] {
  const route = buildDayFillRoute(day, t, { includeTransit: true });
  const out: string[] = [route.theme];
  for (const leg of route.legs) {
    if (leg.kind === "origin") {
      out.push(t("play.plan.timeline_origin", { idx: leg.idx, name: leg.name }));
    } else if (leg.kind === "transit") {
      const transit = leg.modes
        .map((m) => (m.duration ? `${m.label} · ${m.duration}` : m.label))
        .join(t("play.plan.transit.options_join", { or: t("play.plan.transit.or") }));
      out.push(
        t("play.plan.timeline_depart_next", { time: leg.depart }) +
          (transit ? `。${transit}` : ""),
      );
    } else {
      out.push(
        t("play.plan.timeline_stop", {
          idx: leg.idx,
          kind: leg.kindLabel,
          name: leg.name,
          arrive: leg.arrive ?? "",
          dwell: String(leg.dwellMin ?? 0),
        }),
      );
    }
  }
  return out;
}

/** @deprecated Prefer buildFillRouteDays */
export function formatItineraryFillTimeline(days: ItineraryDayDto[], t: T): string[] {
  const lines: string[] = [];
  for (const day of days) {
    if (!day.slots.some((s) => s.kind === "place")) continue;
    lines.push(...formatDayFillTimeline(day, t));
  }
  return lines;
}
