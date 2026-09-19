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

  it("should_append_fill_begin_after_skeleton_and_keep_both_spines", () => {
    const items = buildAssistantThread({
      ...baseInput,
      planCompleteLine: null,
      frameworkReadyLine: "里斯本 4 天框架已经规划完毕：",
      fillBeginLine: "行程框架设计完毕，现在开始完善行程每一站的细节，并安排用餐。",
      skeletonRouteDays: [{ dayIndex: 1, theme: "Belém", legs: [] }],
      fillRouteDays: [{ dayIndex: 1, theme: "Belém details", legs: [] }],
      nextHintLine: null,
      showSoftReplan: false,
    });
    const kinds = items.map((i) => i.kind);
    const introIdx = kinds.indexOf("skeleton_intro");
    const spines = items.filter((i) => i.kind === "spine");
    const fillBeginIdx = kinds.indexOf("fill_begin");
    const skelIdx = items.findIndex((i) => i.kind === "spine" && i.spineVariant === "skeleton");
    const fillIdx = items.findIndex((i) => i.kind === "spine" && i.spineVariant === "fill");
    expect(introIdx).toBeGreaterThanOrEqual(0);
    expect(spines).toHaveLength(2);
    expect(skelIdx).toBeGreaterThan(introIdx);
    expect(fillBeginIdx).toBeGreaterThan(skelIdx);
    expect(fillIdx).toBeGreaterThan(fillBeginIdx);
    expect(items[fillBeginIdx]?.content).toContain("完善行程每一站");
  });

  it("should_omit_next_hint_when_not_provided", () => {
    const items = buildAssistantThread({ ...baseInput, nextHintLine: null, showSoftReplan: false });
    expect(items.map((i) => i.kind)).not.toContain("next_hint");
    expect(items.map((i) => i.kind)).not.toContain("soft_replan");
  });
});
