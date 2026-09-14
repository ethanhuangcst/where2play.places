/**
 * @vitest-environment jsdom
 * T3 UI fixes: combo list escape, deviation notice bubble, friendly i18n reasons.
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlanAssistantNav } from "@/src/ui/plan-assistant-nav";
import { deviationReasonLabel } from "@/src/core/plan-t3-hydrate";
import type { IntakeAnswers, TakeoffFields } from "@/src/core/plan-intake";
import CN from "../messages/CN.json";
import EN from "../messages/EN.json";

function applyTravorShell() {
  document.body.className = "shell-app";
  document.body.dataset.style = "travor";
}

const takeoff: TakeoffFields = {
  destination: "里斯本",
  startDate: "2026-10-10",
  days: 4,
  partySize: 2,
  budget: "mid",
  tripType: "couple_romance",
  pace: "medium",
  transit: "transit_walk",
};

const answers: IntakeAnswers = { b: "Hyatt Regency Lisbon", c: "09:00" };

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
    { id: "skeleton_generating", state: "done" as const },
    { id: "skeleton_ready", state: "done" as const },
  ],
  frameworkReadyLine: "里斯本 4 天 2 人 情侣浪漫行程框架已经规划完毕：",
};

afterEach(() => {
  cleanup();
  document.body.className = "";
  delete document.body.dataset.style;
});

describe("T3 deviations notice bubble (issue 2+3)", () => {
  it("should_render_deviation_block_as_agent_notice_bubble", () => {
    applyTravorShell();
    const { getByTestId } = renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        skeletonDays={skeletonDays}
        deviations={[
          {
            field: "far_cluster",
            expected: "far attraction clusters on their own days within numDays",
            actual: "day 1 co-schedules far cluster(s): Sintra",
            reason:
              "geographically far attraction clusters share a day; validate-don't-repair left the LLM day layout unchanged (no silent day-add)",
          },
        ]}
      />,
    );

    const block = getByTestId("plan-thread-deviations");
    expect(block.className).toContain("bubble");
    expect(block.className).toContain("bubble--agent");
    expect(block.className).toContain("bubble--agent-notice");
  });

  it("should_localize_machine_reasons_not_leak_english_debug_string", () => {
    const t = (key: string) =>
      (CN as Record<string, string>)[key] ?? key;
    const reason = deviationReasonLabel(
      "geographically far attraction clusters share a day; validate-don't-repair left the LLM day layout unchanged (no silent day-add)",
      t,
    );
    expect(reason).not.toMatch(/validate-don't-repair|LLM|silent day-add/);
    expect(reason).toBe(CN["play.plan.deviation_reason.far_cluster_shared_day"]);

    const tEn = (key: string) =>
      (EN as Record<string, string>)[key] ?? key;
    expect(
      deviationReasonLabel(
        "geographically far attraction clusters share a day; validate-don't-repair left the LLM day layout unchanged (no silent day-add)",
        tEn,
      ),
    ).toBe(EN["play.plan.deviation_reason.far_cluster_shared_day"]);
    expect(
      deviationReasonLabel("skeleton day count does not match requested numDays", t),
    ).toBe(CN["play.plan.deviation_reason.day_count_mismatch"]);
    expect(
      deviationReasonLabel(
        "insufficient grounded attractions for requested trip length",
        t,
      ),
    ).toBe(CN["play.plan.deviation_reason.attraction_pool_thin"]);
  });

  it("should_render_friendly_far_cluster_line_with_actual_places", () => {
    applyTravorShell();
    renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        skeletonDays={skeletonDays}
        deviations={[
          {
            field: "far_cluster",
            expected: "",
            actual: "day 1 co-schedules far cluster(s): Sintra, Cascais",
            reason:
              "geographically far attraction clusters share a day; validate-don't-repair left the LLM day layout unchanged (no silent day-add)",
          },
          {
            field: "day_count",
            expected: "4",
            actual: "3",
            reason: "skeleton day count does not match requested numDays",
          },
        ]}
      />,
      "CN",
    );
    const items = document.body.querySelectorAll('[data-testid="plan-thread-deviation-item"]');
    expect(items.length).toBe(2);
    const text1 = items[0].textContent ?? "";
    expect(text1).not.toMatch(/validate-don't-repair|LLM day layout|silent/);
    expect(text1).toContain("Sintra");
    expect(text1).toMatch(/第1天|Day 1/);
    const text2 = items[1].textContent ?? "";
    expect(text2).toMatch(/天数|day count/);
    expect(text2).toContain("4");
    expect(text2).toContain("3");
  });
});

describe("T3 takeover heading bubble (issue 2)", () => {
  it("should_render_takeover_and_headings_as_notice_bubbles", () => {
    applyTravorShell();
    const { getByTestId } = renderWithLocale(<PlanAssistantNav {...baseProps} />);
    for (const id of ["plan-nav-takeover", "plan-thread-skeleton-intro", "plan-nav-next-hint"]) {
      const el = document.body.querySelector(`[data-testid="${id}"]`);
      if (!el) continue;
      expect(el.className).toContain("bubble--agent-notice");
    }
    expect(getByTestId("plan-nav-takeover").className).toContain("bubble--agent-notice");
  });
});
