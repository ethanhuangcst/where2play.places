/**
 * Canonical assistant thread ordering (T3 progress + complete + replan hint).
 * One chronological list: oldest first, newest last.
 */
import type { FillRouteDay } from "./format-fill-timeline";
import type { SkeletonDeviation, T3ProgressStepState } from "./plan-t3-hydrate";

export type ThreadRole = "user" | "assistant" | "system";

export type ThreadKind =
  | "takeover"
  | "progress"
  | "skeleton_intro"
  | "status"
  | "make_elapsed"
  | "spine"
  | "complete"
  | "deviations"
  | "next_hint"
  | "soft_replan"
  | "fill_begin";

export type AssistantThreadItem = {
  id: string;
  role: ThreadRole;
  kind: ThreadKind;
  content?: string;
  statusLines?: string[];
  makeElapsedSeconds?: string;
  spineVariant?: "skeleton" | "fill";
  spineDays?: FillRouteDay[];
  progressSteps?: Array<{ id: string; state: T3ProgressStepState }>;
  deviations?: SkeletonDeviation[];
};

/** Soft two-step: hold skeleton on screen before auto-starting fill. */
export const SKELETON_HOLD_BEFORE_FILL_MS = 2000;

export type BuildAssistantThreadInput = {
  t3Mode: boolean;
  planCompleteLine: string | null;
  frameworkReadyLine: string | null;
  fillBeginLine?: string | null;
  t3ProgressSteps?: Array<{ id: string; state: T3ProgressStepState }>;
  statusLines: string[];
  makeElapsedSeconds: string | null;
  skeletonRouteDays: FillRouteDay[];
  fillRouteDays: FillRouteDay[];
  deviations: SkeletonDeviation[];
  nextHintLine: string | null;
  showSoftReplan: boolean;
  fieldLogActive: boolean;
};

let threadIdSeq = 0;

function nextId(prefix: string): string {
  threadIdSeq += 1;
  return `${prefix}-${threadIdSeq}`;
}

function buildPlanningItems(input: BuildAssistantThreadInput): AssistantThreadItem[] {
  const items: AssistantThreadItem[] = [];

  if (input.t3Mode) {
    items.push({ id: nextId("takeover"), role: "system", kind: "takeover" });
    if (input.t3ProgressSteps?.length) {
      items.push({
        id: nextId("progress"),
        role: "system",
        kind: "progress",
        progressSteps: input.t3ProgressSteps,
      });
    }
    if (input.frameworkReadyLine) {
      items.push({
        id: nextId("skel-intro"),
        role: "system",
        kind: "skeleton_intro",
        content: input.frameworkReadyLine,
      });
    }
  }

  if (input.skeletonRouteDays.length > 0) {
    items.push({
      id: nextId("spine-skel"),
      role: "system",
      kind: "spine",
      spineVariant: "skeleton",
      spineDays: input.skeletonRouteDays,
    });
  }

  if (input.fillBeginLine) {
    items.push({
      id: nextId("fill-begin"),
      role: "system",
      kind: "fill_begin",
      content: input.fillBeginLine,
    });
  }

  if (input.statusLines.length > 0 && !input.planCompleteLine) {
    items.push({
      id: nextId("status"),
      role: "system",
      kind: "status",
      statusLines: input.statusLines,
    });
  }

  if (input.makeElapsedSeconds != null && !input.planCompleteLine) {
    items.push({
      id: nextId("make-elapsed"),
      role: "system",
      kind: "make_elapsed",
      makeElapsedSeconds: input.makeElapsedSeconds,
    });
  }

  if (input.fillRouteDays.length > 0) {
    items.push({
      id: nextId("spine-fill"),
      role: "system",
      kind: "spine",
      spineVariant: "fill",
      spineDays: input.fillRouteDays,
    });
  }

  return items;
}

function buildCompleteItems(input: BuildAssistantThreadInput): AssistantThreadItem[] {
  const items: AssistantThreadItem[] = [];

  if (input.planCompleteLine) {
    items.push({
      id: nextId("complete"),
      role: "system",
      kind: "complete",
      content: input.planCompleteLine,
    });
  }

  if (input.planCompleteLine && input.deviations.length > 0) {
    items.push({
      id: nextId("deviations"),
      role: "system",
      kind: "deviations",
      deviations: input.deviations,
    });
  }

  if (input.nextHintLine) {
    items.push({
      id: nextId("next-hint"),
      role: "system",
      kind: "next_hint",
      content: input.nextHintLine,
    });
  }

  if (input.showSoftReplan && input.planCompleteLine) {
    items.push({ id: nextId("soft-replan"), role: "system", kind: "soft_replan" });
  }

  return items;
}

/** Single source of truth for assistant thread display order. */
export function buildAssistantThread(input: BuildAssistantThreadInput): AssistantThreadItem[] {
  return [...buildPlanningItems(input), ...buildCompleteItems(input)];
}

/** For tests — reset monotonic ids. */
export function resetAssistantThreadIdSeqForTests(): void {
  threadIdSeq = 0;
}
