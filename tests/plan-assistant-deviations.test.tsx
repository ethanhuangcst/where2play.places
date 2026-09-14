/**
 * @vitest-environment jsdom
 * MVP-T3++Q — 2play-plan-103 (TC-T3-103-01 / TC-T3-103-03)
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
  days: 3,
  partySize: 2,
  budget: "mid",
  tripType: "couple_romance",
  pace: "medium",
  transit: "transit_walk",
};

const answers: IntakeAnswers = {
  b: "Hills Hotel",
  c: "09:00",
};

const skeletonDays = [
  {
    dayIndex: 1,
    theme: "Belém",
    stops: [
      { name: "Hills Hotel", kind: "stay", filled: true },
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
  skeletonDays,
  statusLines: [] as string[],
  onOpen: () => undefined,
  onClose: () => undefined,
  onAnswer: () => undefined,
  onTerminate: () => undefined,
  onComplete: () => undefined,
  t3Mode: true,
  t3ProgressSteps: [
    { id: "skeleton_generating", state: "done" as const },
    { id: "skeleton_ready", state: "done" as const },
  ],
  frameworkReadyLine: "Lisbon framework is ready:",
};

describe("plan-assistant deviations (TC-T3-103)", () => {
  afterEach(() => {
    cleanup();
  });

  it("should_list_deviations_under_skeleton_without_warning_panel (TC-T3-103-01)", () => {
    applyTravorShell();
    const { getByTestId, queryByTestId, getAllByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        deviations={[
          {
            field: "far_cluster",
            expected: "own days",
            actual: "day 1 co-schedules far cluster(s): Sintra",
            reason: "far clusters share a day; layout left unchanged",
          },
          {
            field: "day_count",
            expected: "3",
            actual: "2",
            reason: "skeleton day count does not match requested numDays",
          },
        ]}
      />,
    );

    expect(getByTestId("plan-thread-skeleton")).toBeTruthy();
    const block = getByTestId("plan-thread-deviations");
    expect(block).toBeTruthy();
    expect(block.textContent).toContain("The places-agent itinerary could not fully match your request");
    expect(block.textContent).toContain("Far clusters");
    expect(block.textContent).toContain("far clusters share a day");
    expect(block.textContent).toContain("Day count");
    expect(getAllByTestId("plan-thread-deviation-item")).toHaveLength(2);
    expect(queryByTestId("plan-deviations-warning-panel")).toBeNull();
    expect(queryByTestId("plan-deviations-modal")).toBeNull();
    expect(block.closest('[role="dialog"]')).toBeNull();
    expect(block.closest('[role="alertdialog"]')).toBeNull();
  });

  it("should_omit_deviations_block_when_empty (TC-T3-103-03)", () => {
    applyTravorShell();
    const { getByTestId, queryByTestId, rerender } = renderWithLocale(
      <PlanAssistantNav {...baseProps} deviations={[]} />,
    );
    expect(getByTestId("plan-thread-skeleton")).toBeTruthy();
    expect(queryByTestId("plan-thread-deviations")).toBeNull();

    rerender(
      <PlanAssistantNav {...baseProps} />,
    );
    expect(queryByTestId("plan-thread-deviations")).toBeNull();
  });

  it("should_hide_greeting_and_intake_bubbles_in_t3_mode", () => {
    applyTravorShell();
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlanAssistantNav {...baseProps} />,
    );
    expect(getByTestId("plan-nav-takeover")).toBeTruthy();
    expect(queryByTestId("plan-nav-greeting")).toBeNull();
    expect(queryByTestId("plan-nav-intake-answer-b")).toBeNull();
    expect(queryByTestId("plan-nav-intake-answer-c")).toBeNull();
    const progress = getByTestId("plan-progress");
    expect(progress.querySelector('[data-step="trip_created"]')).toBeNull();
    expect(progress.querySelector('[data-step="skeleton_generating"]')).toBeTruthy();
  });
});
