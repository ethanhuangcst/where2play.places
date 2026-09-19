/**
 * @vitest-environment jsdom
 * T3 assistant thread matches 06-plan-assistant-t3.html (no 4Q skip/redo).
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlanAssistantNav } from "@/src/ui/plan-assistant-nav";
import type { IntakeAnswers, TakeoffFields } from "@/src/core/plan-intake";

function applyTravorShell() {
  document.body.className = "shell-app";
  document.body.dataset.style = "travor";
}

const takeoff: TakeoffFields = {
  destination: "Lisbon",
  startDate: "2026-10-10",
  days: 4,
  partySize: 2,
  budget: "mid",
  tripType: "couple_romance",
  pace: "medium",
  transit: "transit_walk",
};

const answers: IntakeAnswers = {
  b: "Hyatt Regency Lisbon",
  c: "09:00",
  h: "walk less",
};

const skeletonDays = [
  {
    dayIndex: 1,
    theme: "Belém",
    stops: [
      { name: "Hyatt Regency Lisbon", kind: "stay", filled: true },
      { name: "Torre de Belém", kind: "place", filled: true },
    ],
  },
];

const baseProps = {
  open: true,
  takeoff,
  currentStep: null as null,
  answers,
  intakeComplete: true,
  skeletonDays: [] as typeof skeletonDays,
  statusLines: [] as string[],
  onOpen: () => undefined,
  onClose: () => undefined,
  onAnswer: () => undefined,
  onTerminate: () => undefined,
  onComplete: () => undefined,
  t3Mode: true,
  t3ProgressSteps: [
    { id: "skeleton_generating", state: "current" as const },
    { id: "skeleton_ready", state: "pending" as const },
  ],
};

describe("plan-assistant T3 thread (mockup 06)", () => {
  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_hide_composer_after_plan_complete", () => {
    applyTravorShell();
    renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        t3Mode
        intakeComplete
        planCompleteLine="上海 · 3 天 · 2 人 · 亲子。行程已规划完毕。"
        nextHintLine="行程不满意可点「重新规划」从头生成。"
        onSoftReplan={() => undefined}
      />,
      "CN",
    );
    expect(document.body.querySelector('[data-testid="plan-thread-complete"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="plan-nav-input"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-soft-replan"]')).toBeTruthy();
  });

  it("should_use_notice_bubbles_and_progress_group_without_skip_redo", () => {
    applyTravorShell();
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlanAssistantNav {...baseProps} />,
    );

    const takeover = getByTestId("plan-nav-takeover");
    expect(takeover.className).toContain("bubble");
    expect(takeover.className).toContain("bubble--agent");
    expect(takeover.className).toContain("bubble--agent-notice");

    const progressGroup = getByTestId("plan-nav-progress");
    expect(progressGroup.className).toContain("msg-group");
    expect(progressGroup.className).toContain("msg-group--agent");
    expect(progressGroup.querySelector('[data-testid="plan-progress"]')).toBeTruthy();

    const context = document.body.querySelector(".plan-nav__context");
    expect(context?.textContent ?? "").not.toMatch(/Q&A|问答|問答/);

    expect(queryByTestId("plan-nav-need-actions")).toBeNull();
    expect(queryByTestId("plan-nav-skip-need")).toBeNull();
    expect(queryByTestId("plan-nav-redo-need")).toBeNull();
    expect(queryByTestId("plan-nav-greeting")).toBeNull();
  });

  it("should_render_framework_ready_as_notice_bubble_when_skeleton_ready", () => {
    applyTravorShell();
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        skeletonDays={skeletonDays}
        t3ProgressSteps={[
          { id: "skeleton_generating", state: "done" },
          { id: "skeleton_ready", state: "done" },
        ]}
        frameworkReadyLine="Lisbon 4-day framework is ready:"
      />,
    );

    const intro = getByTestId("plan-thread-skeleton-intro");
    expect(intro.textContent).toContain("Lisbon 4-day framework is ready:");
    expect(intro.className).toContain("bubble--agent-notice");
    expect(getByTestId("plan-thread-skeleton")).toBeTruthy();
    expect(queryByTestId("plan-nav-skip-need")).toBeNull();
    expect(queryByTestId("plan-nav-next-hint")).toBeNull();
  });

  it("should_place_next_hint_after_plan_complete_in_thread", () => {
    applyTravorShell();
    const { getByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        planCompleteLine="Lisbon · 4 days · trip complete."
        nextHintLine="Not happy with the trip? Tap Replan to start over."
        onSoftReplan={() => undefined}
      />,
    );
    const complete = getByTestId("plan-thread-complete");
    const hint = getByTestId("plan-nav-next-hint");
    expect(
      complete.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(getByTestId("plan-nav-soft-replan")).toBeTruthy();
  });

  it("should_hide_greeting_and_intake_bubbles_in_t3_mode_during_planning", () => {
    applyTravorShell();
    const { queryByTestId, getByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        t3Mode
        intakeComplete
        t3ProgressSteps={[
          { id: "skeleton_generating", state: "done" },
          { id: "skeleton_ready", state: "done" },
          { id: "filling", state: "current" },
        ]}
      />,
    );

    expect(queryByTestId("plan-nav-greeting")).toBeNull();
    expect(queryByTestId("plan-nav-intake-answer-b")).toBeNull();
    expect(queryByTestId("plan-nav-intake-answer-c")).toBeNull();
    expect(queryByTestId("plan-nav-intake-answer-h")).toBeNull();
    expect(getByTestId("plan-nav-progress")).toBeTruthy();
  });

  it("should_keep_skeleton_and_append_fill_begin_then_fill_spine", () => {
    applyTravorShell();
    const { getByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        skeletonDays={skeletonDays}
        fillBeginLine="行程框架设计完毕，现在开始完善行程每一站的细节，并安排用餐。"
        fillRouteDays={[
          {
            dayIndex: 1,
            theme: "Belém",
            legs: [
              {
                kind: "stop",
                idx: "01",
                kindLabel: "景点",
                name: "Torre de Belém",
                arrive: "10:00",
                dwellMin: 60,
              },
            ],
          },
        ]}
        t3ProgressSteps={[
          { id: "skeleton_generating", state: "done" },
          { id: "skeleton_ready", state: "done" },
          { id: "filling", state: "current" },
        ]}
        frameworkReadyLine="Lisbon 4-day framework is ready:"
      />,
      "CN",
    );
    const intro = getByTestId("plan-thread-skeleton-intro");
    const skeleton = getByTestId("plan-thread-skeleton");
    const fillBegin = getByTestId("plan-thread-fill-begin");
    const fill = getByTestId("plan-thread-fill-timeline");
    expect(fillBegin.textContent).toContain("完善行程每一站的细节");
    expect(
      intro.compareDocumentPosition(skeleton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      skeleton.compareDocumentPosition(fillBegin) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      fillBegin.compareDocumentPosition(fill) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should_show_greeting_during_intake_when_t3_mode_false", () => {
    applyTravorShell();
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        t3Mode={false}
        intakeComplete={false}
        currentStep="b"
        answers={{}}
      />,
    );

    expect(getByTestId("plan-nav-greeting")).toBeTruthy();
    expect(queryByTestId("plan-nav-intake-answer-b")).toBeNull();
  });

  it("should_render_progress_label_and_hint_on_separate_elements", () => {
    applyTravorShell();
    renderWithLocale(<PlanAssistantNav {...baseProps} />, "CN");
    const label = document.body.querySelector(".plan-progress__label");
    const hint = document.body.querySelector(".plan-progress__hint");
    expect(label).toBeTruthy();
    expect(hint).toBeTruthy();
    expect(label?.textContent?.trim()).not.toBe("");
    expect(hint?.textContent?.trim()).not.toBe("");
    expect(label?.textContent).not.toBe(hint?.textContent);
  });

  it("should_keep_full_thread_history_when_plan_complete", () => {
    applyTravorShell();
    const { getByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        skeletonDays={skeletonDays}
        frameworkReadyLine="Lisbon 4-day framework is ready:"
        fillBeginLine="Fill begin copy."
        fillRouteDays={[
          {
            dayIndex: 1,
            theme: "Belém",
            legs: [
              {
                kind: "stop",
                idx: "01",
                kindLabel: "Attraction",
                name: "Torre de Belém",
                arrive: "10:00",
                dwellMin: 60,
              },
            ],
          },
        ]}
        t3ProgressSteps={[
          { id: "skeleton_generating", state: "done" },
          { id: "skeleton_ready", state: "done" },
          { id: "filling", state: "done" },
        ]}
        planCompleteLine="Lisbon · 4 days · trip complete."
        nextHintLine="Replan hint."
        onSoftReplan={() => undefined}
      />,
    );
    const takeover = getByTestId("plan-nav-takeover");
    const complete = getByTestId("plan-thread-complete");
    expect(document.body.querySelector(".plan-progress__bead")).toBeTruthy();
    expect(getByTestId("plan-thread-skeleton-intro")).toBeTruthy();
    expect(getByTestId("plan-thread-skeleton")).toBeTruthy();
    expect(getByTestId("plan-thread-fill-begin")).toBeTruthy();
    expect(getByTestId("plan-thread-fill-timeline")).toBeTruthy();
    expect(
      takeover.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should_not_render_legacy_four_question_prompts_in_t3_mode", () => {
    applyTravorShell();
    const { queryByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        agentNeedQuestions={[
          { id: "hotel", prompt: "Where are you staying?" },
          { id: "start_time", prompt: "Start time?" },
          { id: "must_see", prompt: "Must-see?" },
          { id: "other", prompt: "Anything else?" },
          {
            id: "expand_radius",
            prompt: "Widen search?",
            options: [
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ],
          },
        ]}
        agentNeedIndex={0}
        agentNeedAnswers={{}}
      />,
    );

    expect(queryByTestId("plan-nav-need-prompt")?.textContent ?? "").not.toMatch(
      /Where are you staying|Start time|Must-see|Anything else/,
    );
    expect(queryByTestId("plan-nav-intake-answer-b")).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-need-chip-yes"]')).toBeTruthy();
  });
});
