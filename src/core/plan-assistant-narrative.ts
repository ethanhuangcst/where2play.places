import type { SlotPreviewPayload } from "./itinerary-map";
import type { ItineraryDto } from "./itinerary-types";
import { formatTripTypeDisplay } from "./plan-intake";
import { formatSlotPreviewLine } from "./plan-slot-preview";

export type NarrativeT = (key: string, vars?: Record<string, string | number>) => string;

export type PlanNarrativeContext = {
  t: NarrativeT;
  destination: string;
  days: number;
  partySize: number;
  tripType: string;
  skeletonReadyAnnounced: boolean;
  narratedSkeletonDays: Set<number>;
  /** Current in-progress fill line (slot_preview); covered then stripped on done. */
  fillCoverLine: string | null;
};

export function createPlanNarrativeContext(opts: {
  t: NarrativeT;
  destination: string;
  days: number;
  partySize: number;
  tripType?: string;
}): PlanNarrativeContext {
  const raw = opts.tripType?.trim() ?? "";
  const tripTypeLabel =
    formatTripTypeDisplay(raw, opts.t) ||
    raw ||
    opts.t("play.plan.constraint_none");
  return {
    t: opts.t,
    destination: opts.destination,
    days: opts.days,
    partySize: opts.partySize,
    tripType: tripTypeLabel,
    skeletonReadyAnnounced: false,
    narratedSkeletonDays: new Set(),
    fillCoverLine: null,
  };
}

export function appendAssistantLine(lines: string[], line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return lines;
  if (lines.length > 0 && lines[lines.length - 1] === trimmed) return lines;
  return [...lines, trimmed];
}

/** Replace the previous fill-progress cover line (全日一条). */
export function coverFillProgressLine(
  lines: string[],
  ctx: PlanNarrativeContext,
  line: string,
): { lines: string[]; ctx: PlanNarrativeContext } {
  const trimmed = line.trim();
  if (!trimmed) return { lines, ctx };
  let next = lines;
  if (ctx.fillCoverLine) {
    next = next.filter((l) => l !== ctx.fillCoverLine);
  }
  if (next.length > 0 && next[next.length - 1] === trimmed) {
    return { lines: next, ctx: { ...ctx, fillCoverLine: trimmed } };
  }
  return {
    lines: [...next, trimmed],
    ctx: { ...ctx, fillCoverLine: trimmed },
  };
}

export function stripFillCoverLine(
  lines: string[],
  ctx: PlanNarrativeContext,
): { lines: string[]; ctx: PlanNarrativeContext } {
  if (!ctx.fillCoverLine) return { lines, ctx };
  return {
    lines: lines.filter((l) => l !== ctx.fillCoverLine),
    ctx: { ...ctx, fillCoverLine: null },
  };
}

export function narrativeLinesForIntakeComplete(ctx: PlanNarrativeContext): string[] {
  return appendAssistantLine([], ctx.t("play.plan.assistant_know_enough"));
}

export function narrativeLineForSkeletonHeadline(ctx: PlanNarrativeContext): string {
  return ctx.t("play.plan.assistant_skeleton_headline", {
    destination: ctx.destination,
    days: ctx.days,
    partySize: ctx.partySize,
    tripType: ctx.tripType,
  });
}

export function narrativeLineForDiscovering(ctx: PlanNarrativeContext): string {
  return ctx.t("play.plan.assistant_discovering", { destination: ctx.destination || "…" });
}

type PlanNarrativeEvent = {
  type: string;
  phase?: string;
  dayIndex?: number;
  theme?: string;
  stops?: { name: string; kind?: string; meal_slot?: string }[];
  slot?: { name?: string; kind?: string };
  itinerary?: ItineraryDto;
  kind?: string;
  name?: string;
  reason?: string;
  window?: string;
  mealLabel?: string;
  transportLabel?: string;
};

/**
 * Prose-only assistant lines. Fill route-spine is rendered from itinerary via
 * buildFillRouteDays — not stuffed into statusLines (24-P0-ui-B).
 */
export function narrativeFromPlanEvent(
  event: PlanNarrativeEvent,
  ctx: PlanNarrativeContext,
  lines: string[],
): { lines: string[]; ctx: PlanNarrativeContext; completeLine?: string | null } {
  const nextCtx = {
    ...ctx,
    narratedSkeletonDays: new Set(ctx.narratedSkeletonDays),
  };

  if (event.type === "phase" && event.phase === "discovering") {
    const making = nextCtx.t("play.plan.assistant_making");
    if (lines.includes(making)) {
      return { lines, ctx: nextCtx };
    }
    return {
      lines: appendAssistantLine(lines, narrativeLineForDiscovering(nextCtx)),
      ctx: nextCtx,
    };
  }

  if (event.type === "skeleton_day") {
    const dayIndex = event.dayIndex ?? 1;
    if (nextCtx.narratedSkeletonDays.has(dayIndex)) {
      return { lines, ctx: nextCtx };
    }
    nextCtx.narratedSkeletonDays.add(dayIndex);
    const theme = event.theme?.trim() || "";
    const heading = nextCtx.t("play.plan.fill_day_heading", {
      n: dayIndex,
      theme: theme || String(dayIndex),
    });
    return { lines: appendAssistantLine(lines, heading), ctx: nextCtx };
  }

  if (event.type === "skeleton_done" && !nextCtx.skeletonReadyAnnounced) {
    nextCtx.skeletonReadyAnnounced = true;
    return {
      lines: appendAssistantLine(lines, nextCtx.t("play.plan.assistant_skeleton_ready")),
      ctx: nextCtx,
    };
  }

  if (event.type === "slot_preview" && event.kind && event.name) {
    const preview = event as PlanNarrativeEvent & SlotPreviewPayload;
    const line = formatSlotPreviewLine(preview, nextCtx.t);
    return coverFillProgressLine(lines, nextCtx, line);
  }

  if (event.type === "stop_filled" && event.itinerary) {
    // Spine updates via fillRouteDays in plan-page; strip cover so prose stays clean.
    return stripFillCoverLine(lines, nextCtx);
  }

  if (event.type === "stop_filled" && event.slot?.name) {
    return coverFillProgressLine(
      lines,
      nextCtx,
      nextCtx.t("play.plan.assistant_filling_stop", { name: event.slot.name }),
    );
  }

  if (event.type === "day_done" && event.itinerary) {
    return stripFillCoverLine(lines, nextCtx);
  }

  if (event.type === "done") {
    // Progress prose cleared; complete line renders AFTER fill spine (tmp-ui bug #4).
    return {
      lines: [],
      ctx: { ...nextCtx, fillCoverLine: null },
      completeLine: nextCtx.t("play.plan.assistant_plan_complete", {
        destination: nextCtx.destination,
        days: String(nextCtx.days),
        party: String(nextCtx.partySize),
        tripType: nextCtx.tripType,
      }),
    };
  }

  return { lines, ctx: nextCtx };
}
