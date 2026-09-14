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
    expect(intro.className).toContain("bubble--agent-notice");
    expect(intro.textContent).toContain("Lisbon 4-day framework is ready:");
    expect(getByTestId("plan-thread-skeleton")).toBeTruthy();
    expect(queryByTestId("plan-nav-skip-need")).toBeNull();
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
