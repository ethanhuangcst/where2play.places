import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAssistantThread,
  resetAssistantThreadIdSeqForTests,
} from "@/src/core/plan-assistant-thread";

const baseInput = {
  t3Mode: true,
  planCompleteLine: "上海 · 3 天 · 2 人 · 亲子。行程已规划完毕。",
  frameworkReadyLine: null,
  t3ProgressSteps: undefined,
  statusLines: [],
  makeElapsedSeconds: null,
  skeletonRouteDays: [],
  fillRouteDays: [{ dayIndex: 1, theme: "Day 1", legs: [] }],
  deviations: [],
  nextHintLine: "行程不满意可点「重新规划」从头生成。",
  showSoftReplan: true,
  fieldLogActive: true,
};

describe("buildAssistantThread (ADR-071 replan-only)", () => {
  beforeEach(() => {
    resetAssistantThreadIdSeqForTests();
  });

  it("should_order_complete_then_hint_then_soft_replan_without_refine_chat", () => {
    const items = buildAssistantThread(baseInput);
    const kinds = items.map((i) => i.kind);
    const completeIdx = kinds.indexOf("complete");
    const hintIdx = kinds.indexOf("next_hint");
    const replanIdx = kinds.indexOf("soft_replan");
    expect(completeIdx).toBeGreaterThanOrEqual(0);
    expect(hintIdx).toBeGreaterThan(completeIdx);
    expect(replanIdx).toBeGreaterThan(hintIdx);
    expect(kinds).not.toContain("user");
    expect(kinds).not.toContain("assistant");
    expect(kinds).not.toContain("refine_progress");
  });

  it("should_omit_next_hint_when_not_provided", () => {
    const items = buildAssistantThread({ ...baseInput, nextHintLine: null, showSoftReplan: false });
    expect(items.map((i) => i.kind)).not.toContain("next_hint");
    expect(items.map((i) => i.kind)).not.toContain("soft_replan");
  });
});
