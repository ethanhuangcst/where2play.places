import type { ItineraryPlaceSlot, ItinerarySlot, ItineraryTransitSlot } from "./itinerary-types";

export type AgentLeg = {
  mode?: string;
  duration_min?: number;
  recommended?: boolean;
  deeplinks?: Record<string, string>;
};

export type StopDisplayPayload = {
  stop?: {
    name?: string;
    kind?: string;
    card?: {
      provider?: string;
      name?: string;
      photos?: string[];
      sources?: Array<{ provider?: string; native_id?: string; deeplinks?: Record<string, string> }>;
    } | null;
    deeplinks?: Record<string, string>;
  };
  slot?: { start?: string; end?: string };
  legs_to_here?: AgentLeg[];
};

function firstDeeplink(links?: Record<string, string>): string | undefined {
  if (!links) return undefined;
  for (const v of Object.values(links)) {
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  return undefined;
}

function nativeIdFromCard(card?: {
  provider?: string;
  sources?: Array<{ provider?: string; native_id?: string }>;
} | null): { provider?: string; nativeId?: string } {
  const src = card?.sources?.[0];
  return { provider: src?.provider ?? card?.provider, nativeId: src?.native_id };
}

export function transitLineFromLeg(leg: AgentLeg, t: (key: string, vars?: Record<string, string>) => string): string {
  const mode = leg.mode ?? "transit";
  const min = leg.duration_min != null ? String(leg.duration_min) : "?";
  const modeKey = `play.plan.transit.mode.${mode}`;
  const modeLabel = t(modeKey);
  return t("play.plan.transit.line", { mode: modeLabel, minutes: min });
}

export function mapStopDisplayToPlaceSlot(
  display: StopDisplayPayload,
  t: (key: string, vars?: Record<string, string>) => string,
  opts?: { visit_part?: string },
): ItineraryPlaceSlot {
  const stop = display.stop ?? {};
  const card = stop.card ?? undefined;
  const slot = display.slot ?? { start: "09:00", end: "10:00" };
  const { provider, nativeId } = nativeIdFromCard(card);
  const deeplinks = { ...(stop.deeplinks ?? {}), ...(card?.sources?.[0]?.deeplinks ?? {}) };
  const mapUrl = firstDeeplink(deeplinks);
  const kind = stop.kind ?? "attraction";
  const placeKind =
    kind === "stay" ? "stay" : kind === "meal" ? "meal" : "attraction";
  const photoUrl = Array.isArray(card?.photos) ? card!.photos[0] : undefined;
  const baseName = stop.name ?? card?.name ?? "?";
  const visitPart = opts?.visit_part;
  let name =
    visitPart === "am"
      ? t("play.plan.visit_part_am", { name: baseName })
      : visitPart === "pm"
        ? t("play.plan.visit_part_pm", { name: baseName })
        : baseName;
  if (placeKind === "stay") {
    name = t("play.plan.origin_stop", { name: baseName });
  }
  return {
    kind: "place",
    start: slot.start ?? "09:00",
    end: slot.end ?? slot.start ?? "09:00",
    placeKind,
    name,
    summary: "",
    photoUrl,
    provider,
    nativeId,
    detailsUrl: mapUrl,
    mapUrl,
  };
}

export function mapLegsToTransitSlot(
  legs: AgentLeg[] | undefined,
  t: (key: string, vars?: Record<string, string>) => string,
): ItineraryTransitSlot | null {
  if (!legs?.length) return null;
  // F91 / F88 UI gate: hide walk>45 and transit|drive>120.
  const kept = legs.filter((leg) => {
    const min = leg.duration_min;
    if (typeof min !== "number") return true;
    if (leg.mode === "walk") return min <= 45;
    return min <= 120;
  });
  if (!kept.length) return null;
  const lines = kept.map((leg) => transitLineFromLeg(leg, t));
  const or = t("play.plan.transit.or");
  const text =
    lines.length === 1
      ? lines[0]!
      : lines.join(t("play.plan.transit.options_join", { or }));
  return {
    kind: "transit",
    start: "",
    text,
  };
}

export function skeletonDayHighlights(
  dayIndex: number,
  theme: string | undefined,
  t: (key: string, vars?: Record<string, string>) => string,
) {
  const title = theme?.trim() || t("play.plan.day_n", { n: String(dayIndex) });
  return {
    label: t("play.plan.highlights_label"),
    title,
    theme: undefined,
    tags: [] as string[],
  };
}
