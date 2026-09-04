import type { SlotPreviewPayload } from "./itinerary-map";
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
};

export function createPlanNarrativeContext(opts: {
  t: NarrativeT;
  destination: string;
  days: number;
  partySize: number;
  tripType?: string;
}): PlanNarrativeContext {
  return {
    t: opts.t,
    destination: opts.destination,
    days: opts.days,
    partySize: opts.partySize,
    tripType: opts.tripType?.trim() || opts.t("play.plan.constraint_none"),
    skeletonReadyAnnounced: false,
    narratedSkeletonDays: new Set(),
  };
}

export function appendAssistantLine(lines: string[], line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return lines;
  if (lines.length > 0 && lines[lines.length - 1] === trimmed) return lines;
  return [...lines, trimmed];
}

export function narrativeLinesForIntakeComplete(ctx: PlanNarrativeContext): string[] {
  return appendAssistantLine([], ctx.t("play.plan.assistant_planning_skeleton"));
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
  kind?: string;
  name?: string;
  reason?: string;
  window?: string;
  mealLabel?: string;
  transportLabel?: string;
};

export function narrativeFromPlanEvent(
  event: PlanNarrativeEvent,
  ctx: PlanNarrativeContext,
  lines: string[],
): { lines: string[]; ctx: PlanNarrativeContext } {
  const nextCtx = { ...ctx, narratedSkeletonDays: new Set(ctx.narratedSkeletonDays) };

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
    let out = lines;
    if (event.theme?.trim()) {
      out = appendAssistantLine(out, event.theme.trim());
    }
    for (const stop of event.stops ?? []) {
      if (stop.kind === "stay") {
        out = appendAssistantLine(
          out,
          nextCtx.t("play.plan.depart_from_stay", { name: stop.name }),
        );
      } else {
        out = appendAssistantLine(out, stop.name);
      }
    }
    return { lines: out, ctx: nextCtx };
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
    return { lines: appendAssistantLine(lines, line), ctx: nextCtx };
  }

  if (event.type === "stop_filled" && event.slot?.name) {
    return {
      lines: appendAssistantLine(
        lines,
        nextCtx.t("play.plan.assistant_filling_stop", { name: event.slot.name }),
      ),
      ctx: nextCtx,
    };
  }

  if (event.type === "done") {
    return {
      lines: appendAssistantLine(
        lines,
        nextCtx.t("play.plan.assistant_plan_complete", {
          destination: nextCtx.destination,
          days: String(nextCtx.days),
          party: String(nextCtx.partySize),
          tripType: nextCtx.tripType,
        }),
      ),
      ctx: nextCtx,
    };
  }

  return { lines, ctx: nextCtx };
}
