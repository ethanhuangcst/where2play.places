import type {
  ItineraryDto,
  ItineraryPlaceSlot,
  ItinerarySlot,
  PlanBoundaries,
} from "./itinerary-types";

type AgentLoc = { lat: number; lng: number; crs?: string };

type AgentPlace = {
  provider?: string;
  name: string;
  category?: string;
  address?: string;
  photos?: string[];
  location?: AgentLoc;
  sources?: Array<{
    provider?: string;
    native_id?: string;
    deeplinks?: Record<string, string>;
  }>;
};

type AgentLeg = {
  mode?: string;
  duration_min?: number;
  recommended?: boolean;
  deeplinks?: Record<string, string>;
};

type AgentVisit = {
  kind: "visit";
  slot: { start: string; end: string };
  place: AgentPlace;
  legs_to_here?: AgentLeg[];
  legs_to_destination?: AgentLeg[];
};

type AgentMeal = {
  kind: "meal";
  meal?: string;
  slot: { start: string; end: string };
  options?: Array<{ place: AgentPlace; leg_from_previous?: AgentLeg }>;
};

/** Legacy timed engine blocks (kind visit/meal). */
type AgentTimedBlock = AgentVisit | AgentMeal;

/** LLM / arrange_day blocks (ADR-032). */
export type AgentLlmBlock = {
  name: string;
  type: "attraction" | "lunch" | "dinner" | "cafe" | string;
  start_time: string;
  duration_min: number;
  reason?: string;
  photos?: string[];
  legs_to_here?: AgentLeg[];
};

type AgentLlmTransport = {
  transport?: string;
  duration_min?: number;
  depart_time?: string;
  arrive_time?: string;
};

export type SlotPreviewPayload = {
  kind: "place" | "transit" | "meal";
  name: string;
  reason: string;
  window: string;
  mealLabel?: "lunch" | "afternoon_tea" | "dinner";
  transportLabel?: string;
};

export type ExpandedArrangeSlot = {
  slot: ItinerarySlot;
  preview: SlotPreviewPayload;
};

export type AgentTimedPlan = {
  detail?: string;
  timezone?: string;
  search_anchor?: { name?: string };
  preferences_applied?: { pace?: string; transit_preferred?: boolean };
  days?: Array<{
    day_index?: number;
    date?: string;
    from_origin?: AgentLlmTransport;
    to_destination?: AgentLlmTransport;
    blocks?: Array<AgentTimedBlock | AgentLlmBlock | Record<string, unknown>>;
  }>;
};

function secretFreeUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  if (!/^https:\/\//i.test(url)) return undefined;
  if (/[?&](key|api[_-]?key)=/i.test(url)) return undefined;
  return url;
}

function pickDeeplink(place: AgentPlace, keys: string[]): string | undefined {
  const links = place.sources?.[0]?.deeplinks ?? {};
  for (const key of keys) {
    const v = secretFreeUrl(links[key]);
    if (v) return v;
  }
  for (const v of Object.values(links)) {
    const cleaned = secretFreeUrl(v);
    if (cleaned) return cleaned;
  }
  return undefined;
}

function modeLabel(mode?: string): string {
  if (mode === "walk") return "walk";
  if (mode === "drive") return "drive";
  if (mode === "transit") return "transit";
  return mode ?? "transit";
}

function legPreviewText(leg: AgentLeg): { label: string; duration: string; reasonKey: string } {
  const mins = leg.duration_min != null ? `${leg.duration_min}` : "?";
  return {
    label: modeLabel(leg.mode),
    duration: `~${mins} min`,
    reasonKey: "play.plan.transit_directions",
  };
}

function legSlotText(leg: AgentLeg): string {
  const mins = leg.duration_min != null ? ` · ~${leg.duration_min} min` : "";
  return `${modeLabel(leg.mode)}${mins}`;
}

function legText(leg: AgentLeg): string {
  const mins = leg.duration_min != null ? ` · ~${leg.duration_min} min` : "";
  return `${modeLabel(leg.mode)}${mins}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addMinutes(hhmm: string, mins: number): string {
  // plan-14: accept single-digit hours (H:MM); normalize before computing.
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const total = Number(m[1]) * 60 + Number(m[2]) + mins;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

function placeKindFromLlmType(type: string): string {
  if (type === "lunch") return "Food";
  if (type === "dinner") return "Dinner";
  if (type === "cafe") return "Cafe";
  return "Attraction";
}

function isLlmBlock(block: Record<string, unknown>): block is AgentLlmBlock {
  return (
    typeof block.name === "string" &&
    typeof block.type === "string" &&
    typeof block.start_time === "string" &&
    typeof block.duration_min === "number" &&
    !("kind" in block)
  );
}

function isTimedVisit(block: Record<string, unknown>): block is AgentVisit {
  return block.kind === "visit";
}

function isTimedMeal(block: Record<string, unknown>): block is AgentMeal {
  return block.kind === "meal";
}

function toPlaceSlot(
  place: AgentPlace,
  start: string,
  end: string,
  placeKindFallback: string,
  summaryFallback = "",
): ItineraryPlaceSlot {
  const photo = place.photos?.find((p) => typeof p === "string" && p.startsWith("http"));
  const source = place.sources?.[0];
  return {
    kind: "place",
    start,
    end,
    placeKind: place.category?.trim() || placeKindFallback,
    name: place.name,
    summary: place.address?.trim() || summaryFallback,
    ...(photo ? { photoUrl: photo } : {}),
    ...(place.provider ? { provider: place.provider } : {}),
    ...(source?.native_id ? { nativeId: source.native_id } : {}),
    ...(pickDeeplink(place, ["details", "detail", "place"])
      ? { detailsUrl: pickDeeplink(place, ["details", "detail", "place"]) }
      : {}),
    ...(pickDeeplink(place, ["map", "maps", "directions"])
      ? { mapUrl: pickDeeplink(place, ["map", "maps", "directions"]) }
      : {}),
  };
}

function mapLlmTransport(
  t: AgentLlmTransport | undefined,
  startFallback: string,
): ExpandedArrangeSlot | null {
  if (!t) return null;
  const mins = t.duration_min != null ? t.duration_min : undefined;
  const label = t.transport?.trim() || "transit";
  const text = mins != null ? `${label} · ~${mins} min` : label;
  const window = mins != null ? `~${mins} min` : "~15 min";
  const start = t.depart_time || startFallback;
  return {
    slot: { kind: "transit", start, text },
    preview: {
      kind: "transit",
      name: label,
      reason: "Transfer to the next stop",
      window,
      transportLabel: label,
    },
  };
}

function estimateTransferMin(transport?: string): number {
  const t = (transport || "").toLowerCase();
  if (t.includes("walk") || t.includes("步行")) return 12;
  if (t.includes("taxi") || t.includes("打车") || t.includes("drive") || t.includes("驾车")) return 20;
  return 15;
}

function transportModeLabel(transport?: string): string {
  const raw = transport?.trim();
  return raw && raw.length > 0 ? raw : "transit";
}

export function mealLabelForBlock(
  type: string,
  startTime: string,
): "lunch" | "afternoon_tea" | "dinner" | undefined {
  if (type === "dinner") return "dinner";
  if (type === "cafe") return "afternoon_tea";
  if (type === "lunch") {
    return startTime >= "15:00" ? "afternoon_tea" : "lunch";
  }
  return undefined;
}

function normalizeHhmm(hhmm: string): string {
  // plan-14: H:MM → HH:MM for display consistency.
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return `${pad2(Number(m[1]))}:${m[2]}`;
}

function placeBlockToExpanded(block: AgentLlmBlock): ExpandedArrangeSlot {
  const start = normalizeHhmm(block.start_time);
  const end = addMinutes(start, block.duration_min);
  const photo = block.photos?.find((p) => typeof p === "string" && p.startsWith("http"));
  const reason = block.reason?.trim() || "";
  const mealLabel = mealLabelForBlock(block.type, start);
  const slot: ItinerarySlot = {
    kind: "place",
    start,
    end,
    placeKind: placeKindFromLlmType(block.type),
    name: block.name,
    summary: reason,
    ...(photo ? { photoUrl: photo } : {}),
  };
  if (mealLabel) {
    return {
      slot,
      preview: {
        kind: "meal",
        name: block.name,
        reason,
        window: `${start}–${end}`,
        mealLabel,
      },
    };
  }
  return {
    slot,
    preview: {
      kind: "place",
      name: block.name,
      reason,
      window: `${start}–${end}`,
    },
  };
}

/** Early stream preview for a single validated LLM block (plan-12). */
export function previewForArrangeBlock(block: AgentLlmBlock): SlotPreviewPayload {
  return placeBlockToExpanded(block).preview;
}

function synthesizeInterStopTransit(
  prev: AgentLlmBlock,
  transport?: string,
): ExpandedArrangeSlot {
  const label = transportModeLabel(transport);
  const mins = estimateTransferMin(transport);
  const start = addMinutes(prev.start_time, prev.duration_min);
  return {
    slot: {
      kind: "transit",
      start,
      text: `${label} · ~${mins} min`,
    },
    preview: {
      kind: "transit",
      name: label,
      reason: "play.plan.transit_estimated",
      window: `~${mins} min`,
      transportLabel: label,
    },
  };
}

function enrichedInterStopTransitFromLegs(
  legs: AgentLeg[],
  start: string,
  transitOutcome?: "directions" | "heuristic" | "partial",
): ExpandedArrangeSlot | null {
  if (!legs.length) return null;
  const leg = legs.find((l) => l.recommended) ?? legs[0];
  if (!leg) return null;
  const { label, duration, reasonKey } = legPreviewText(leg);
  const reason =
    transitOutcome === "heuristic" || transitOutcome === "partial"
      ? "play.plan.transit_estimated"
      : reasonKey;
  return {
    slot: {
      kind: "transit",
      start,
      text: legSlotText(leg),
    },
    preview: {
      kind: "transit",
      name: label,
      reason,
      window: duration,
      transportLabel: label,
    },
  };
}

/**
 * Single source for progressive `slot` emit and final day DTO slots (itinerary-design §5.3).
 * Uses agent legs_to_here when present; otherwise synthesizes from criteria.transport.
 */
export function expandArrangeDayToSlots(
  blocks: AgentLlmBlock[],
  day: { from_origin?: AgentLlmTransport; to_destination?: AgentLlmTransport } = {},
  criteria: {
    transport?: string;
    transit_outcome?: "directions" | "heuristic" | "partial";
  } = {},
): ExpandedArrangeSlot[] {
  const out: ExpandedArrangeSlot[] = [];
  if (!blocks.length) return out;

  const hasEnrichedLegs = blocks.some((b) => (b.legs_to_here?.length ?? 0) > 0);
  const firstStart = blocks[0]?.start_time ?? "09:00";
  const firstBlockHasLegs = (blocks[0]?.legs_to_here?.length ?? 0) > 0;
  const from = firstBlockHasLegs ? null : mapLlmTransport(day.from_origin, firstStart);
  if (from) out.push(from);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (hasEnrichedLegs) {
      if (block.legs_to_here?.length) {
        const prev = i > 0 ? blocks[i - 1]! : null;
        const start = prev
          ? addMinutes(prev.start_time, prev.duration_min)
          : block.start_time;
        const transit = enrichedInterStopTransitFromLegs(
          block.legs_to_here,
          start,
          criteria.transit_outcome,
        );
        if (transit) out.push(transit);
      }
    } else if (i > 0) {
      out.push(synthesizeInterStopTransit(blocks[i - 1]!, criteria.transport));
    }
    out.push(placeBlockToExpanded(block));
  }

  const last = blocks[blocks.length - 1]!;
  const to = mapLlmTransport(
    day.to_destination,
    addMinutes(last.start_time, last.duration_min),
  );
  if (to) out.push(to);
  return out;
}

function mapLlmDayBlocks(
  blocks: AgentLlmBlock[],
  day: { from_origin?: AgentLlmTransport; to_destination?: AgentLlmTransport },
  transport?: string,
): ItinerarySlot[] {
  return expandArrangeDayToSlots(blocks, day, { transport }).map((e) => e.slot);
}

function mapTimedDayBlocks(blocks: AgentTimedBlock[]): ItinerarySlot[] {
  const slots: ItinerarySlot[] = [];
  for (const block of blocks) {
    if (block.kind === "visit") {
      for (const leg of block.legs_to_here ?? []) {
        slots.push({
          kind: "transit",
          start: block.slot.start,
          text: legText(leg),
        });
      }
      slots.push(toPlaceSlot(block.place, block.slot.start, block.slot.end, "Attraction"));
      for (const leg of block.legs_to_destination ?? []) {
        slots.push({
          kind: "transit",
          start: block.slot.end,
          text: legText(leg),
        });
      }
      continue;
    }
    const option = block.options?.[0];
    if (!option?.place) continue;
    if (option.leg_from_previous) {
      slots.push({
        kind: "transit",
        start: block.slot.start,
        text: legText(option.leg_from_previous),
      });
    }
    const mealKind =
      block.meal === "cafe" ? "Cafe" : block.meal === "dinner" ? "Dinner" : "Food";
    slots.push(toPlaceSlot(option.place, block.slot.start, block.slot.end, mealKind));
  }
  return slots;
}

function mapDayBlocks(
  rawBlocks: Array<Record<string, unknown>>,
  day: { from_origin?: AgentLlmTransport; to_destination?: AgentLlmTransport },
  transport?: string,
): ItinerarySlot[] {
  if (!rawBlocks.length) return [];
  if (rawBlocks.every((b) => isLlmBlock(b))) {
    return mapLlmDayBlocks(rawBlocks as AgentLlmBlock[], day, transport);
  }
  const timed: AgentTimedBlock[] = [];
  for (const b of rawBlocks) {
    if (isTimedVisit(b) || isTimedMeal(b)) timed.push(b);
  }
  return mapTimedDayBlocks(timed);
}

function highlightTitle(slots: ItinerarySlot[]): string {
  const names = slots
    .filter((s): s is ItineraryPlaceSlot => s.kind === "place")
    .map((s) => s.name)
    .slice(0, 3);
  return names.join(" · ") || "—";
}

function highlightTags(slots: ItinerarySlot[]): string[] {
  const kinds = new Set<string>();
  for (const s of slots) {
    if (s.kind === "place" && s.placeKind) kinds.add(s.placeKind);
  }
  return [...kinds].slice(0, 6);
}

function dayWindow(slots: ItinerarySlot[]): string | undefined {
  const times: string[] = [];
  for (const s of slots) {
    if (s.start) times.push(s.start);
    if (s.kind === "place" && s.end) times.push(s.end);
  }
  if (times.length < 2) return times[0];
  return `${times[0]}–${times[times.length - 1]}`;
}

export function mapTimedPlanToItineraryDto(
  plan: AgentTimedPlan,
  criteria: Pick<PlanBoundaries, "destination" | "days" | "pace" | "transport">,
  now: Date = new Date(),
): ItineraryDto {
  const destination = criteria.destination.trim();
  const agentDays = Array.isArray(plan.days) ? plan.days : [];
  const days = agentDays.map((day, idx) => {
    const raw = Array.isArray(day.blocks) ? (day.blocks as Array<Record<string, unknown>>) : [];
    const slots = mapDayBlocks(
      raw,
      {
        from_origin: day.from_origin,
        to_destination: day.to_destination,
      },
      criteria.transport,
    );
    const dayIndex = typeof day.day_index === "number" ? day.day_index : idx + 1;
    return {
      dayIndex,
      highlights: {
        label: "Highlights",
        title: highlightTitle(slots),
        tags: highlightTags(slots),
      },
      meta: {
        ...(criteria.transport ? { transport: criteria.transport } : {}),
        ...(criteria.pace || plan.preferences_applied?.pace
          ? { pace: criteria.pace || plan.preferences_applied?.pace }
          : {}),
        ...(dayWindow(slots) ? { window: dayWindow(slots) } : {}),
      },
      slots,
    };
  });

  const daysCount = days.length || criteria.days;
  const title =
    daysCount > 1 ? `${destination} · ${daysCount} days` : `${destination} day trip`;

  return {
    title,
    destination,
    daysCount,
    updatedAt: now.toISOString(),
    days,
  };
}
