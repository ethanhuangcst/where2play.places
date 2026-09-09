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
    provider?: string;
    native_id?: string;
    nativeId?: string;
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

export type PoolCandidateLike = {
  name?: string;
  provider?: string;
  photos?: string[];
  address?: string;
  rating?: number;
  sources?: Array<{ provider?: string; native_id?: string; deeplinks?: Record<string, string> }>;
};

/** Match discover/trip candidate by venue name or native_id for photo + ids. */
export function lookupPoolCandidate(
  name: string | undefined,
  pool?: { places?: PoolCandidateLike[]; restaurants?: PoolCandidateLike[] } | null,
  opts?: { nativeId?: string; provider?: string },
): { provider?: string; nativeId?: string; photoUrl?: string; deeplinks?: Record<string, string>; address?: string; rating?: number } | null {
  if (!pool) return null;
  const all = [...(pool.places ?? []), ...(pool.restaurants ?? [])];
  const needleId = opts?.nativeId?.trim();
  let card =
    needleId
      ? all.find((p) =>
          (p.sources ?? []).some((s) => s.native_id === needleId),
        )
      : undefined;
  const needle = name?.trim();
  if (!card && needle) {
    const lower = needle.toLowerCase();
    card =
      all.find((p) => (p.name ?? "").trim() === needle) ??
      all.find((p) => (p.name ?? "").trim().toLowerCase() === lower) ??
      all.find((p) => {
        const n = (p.name ?? "").trim().toLowerCase();
        return n.includes(lower) || lower.includes(n);
      });
  }
  if (!card) return null;
  const src =
    (needleId ? card.sources?.find((s) => s.native_id === needleId) : undefined) ??
    card.sources?.find((s) => s.native_id) ??
    card.sources?.[0];
  const photoUrl = Array.isArray(card.photos)
    ? card.photos.find((p) => typeof p === "string" && p.startsWith("http"))
    : undefined;
  return {
    provider: src?.provider ?? card.provider ?? opts?.provider,
    nativeId: src?.native_id ?? needleId,
    photoUrl,
    deeplinks: src?.deeplinks,
    address: typeof (card as { address?: string }).address === "string" ? (card as { address?: string }).address : undefined,
    rating: typeof (card as { rating?: number }).rating === "number" ? (card as { rating?: number }).rating : undefined,
  };
}

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
  opts?: {
    visit_part?: string;
    provider?: string;
    nativeId?: string;
    photoUrl?: string;
    mealSlot?: string;
    pool?: { places?: PoolCandidateLike[]; restaurants?: PoolCandidateLike[] } | null;
  },
): ItineraryPlaceSlot {
  const stop = display.stop ?? {};
  const card = stop.card ?? undefined;
  const slot = display.slot ?? { start: "09:00", end: "10:00" };
  const fromCard = nativeIdFromCard(card);
  const baseName = stop.name ?? card?.name ?? "?";
  const fromPool = lookupPoolCandidate(baseName, opts?.pool, {
    nativeId: opts?.nativeId ?? stop.native_id ?? stop.nativeId,
    provider: opts?.provider ?? stop.provider,
  });
  const provider =
    opts?.provider ?? fromCard.provider ?? stop.provider ?? fromPool?.provider;
  const nativeId =
    opts?.nativeId ??
    fromCard.nativeId ??
    stop.native_id ??
    stop.nativeId ??
    fromPool?.nativeId;
  const deeplinks = {
    ...(stop.deeplinks ?? {}),
    ...(card?.sources?.[0]?.deeplinks ?? {}),
    ...(fromPool?.deeplinks ?? {}),
  };
  const mapUrl = firstDeeplink(deeplinks);
  const kind = stop.kind ?? "attraction";
  const placeKind =
    kind === "stay" ? "stay" : kind === "meal" || opts?.mealSlot ? "meal" : "attraction";
  const photoFromCard = Array.isArray(card?.photos)
    ? card!.photos.find((p) => typeof p === "string" && p.startsWith("http"))
    : undefined;
  const photoUrl = photoFromCard ?? opts?.photoUrl ?? fromPool?.photoUrl;
  const summary =
    (typeof (card as { address?: string } | undefined)?.address === "string"
      ? (card as { address?: string }).address
      : undefined) ??
    fromPool?.address ??
    "";
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
    summary: summary ?? "",
    ...(photoUrl ? { photoUrl } : {}),
    ...(provider ? { provider } : {}),
    ...(nativeId ? { nativeId } : {}),
    ...(opts?.mealSlot ? { mealSlot: opts.mealSlot } : {}),
    detailsUrl: mapUrl,
    mapUrl,
  };
}

export function mapLegsToTransitSlot(
  legs: AgentLeg[] | undefined,
  t: (key: string, vars?: Record<string, string>) => string,
  opts?: { from?: string; to?: string; outcome?: string },
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
    ...(opts?.from ? { from: opts.from } : {}),
    ...(opts?.to ? { to: opts.to } : {}),
    ...(opts?.outcome ? { outcome: opts.outcome } : {}),
    legs: kept.map((leg) => ({
      mode: leg.mode ?? "transit",
      duration_min: leg.duration_min ?? 0,
      ...(leg.recommended ? { recommended: true } : {}),
    })),
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
