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
        planCompleteLine="里斯本 · 4 天 · 2 人 · 情侣浪漫。行程已规划完毕。"
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
        planCompleteLine="里斯本 · 4 天 · 2 人 · 情侣浪漫。行程已规划完毕。"
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
    for (const id of ["plan-nav-takeover", "plan-thread-skeleton-intro"]) {
      const el = document.body.querySelector(`[data-testid="${id}"]`);
      if (!el) continue;
      expect(el.className).toContain("bubble--agent-notice");
    }
    expect(getByTestId("plan-nav-takeover").className).toContain("bubble--agent-notice");
  });

  it("should_not_render_next_hint_until_plan_complete_line", () => {
    applyTravorShell();
    const { queryByTestId } = renderWithLocale(<PlanAssistantNav {...baseProps} />);
    expect(queryByTestId("plan-nav-next-hint")).toBeNull();
    expect(queryByTestId("plan-nav-soft-replan")).toBeNull();
  });

  it("should_render_next_hint_and_soft_replan_after_complete_bubble", () => {
    applyTravorShell();
    const completeLine = "里斯本 · 4 天 · 2 人 · 情侣浪漫。行程已规划完毕。";
    renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        planCompleteLine={completeLine}
        nextHintLine={CN["play.plan.assistant_next_hint"]}
        deviations={[
          {
            field: "far_cluster",
            expected: "",
            actual: "day 2 co-schedules far cluster(s): 上海自然博物馆",
            reason:
              "geographically far attraction clusters share a day; validate-don't-repair left the LLM day layout unchanged (no silent day-add)",
          },
        ]}
        onSoftReplan={() => undefined}
      />,
      "CN",
    );
    const complete = document.body.querySelector('[data-testid="plan-thread-complete"]');
    const deviations = document.body.querySelector('[data-testid="plan-thread-deviations"]');
    const hint = document.body.querySelector('[data-testid="plan-nav-next-hint"]');
    const replan = document.body.querySelector('[data-testid="plan-nav-soft-replan"]');
    expect(complete).toBeTruthy();
    expect(deviations).toBeTruthy();
    expect(hint).toBeTruthy();
    expect(replan).toBeTruthy();
    expect(hint!.className).toContain("bubble--agent-notice");
    expect(
      complete!.compareDocumentPosition(deviations!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      deviations!.compareDocumentPosition(hint!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      hint!.compareDocumentPosition(replan!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should_render_plan_complete_line_as_notice_bubble_after_fill_spine", () => {
    applyTravorShell();
    renderWithLocale(
      <PlanAssistantNav
        {...baseProps}
        t3Mode
        intakeComplete
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
        planCompleteLine="里斯本 · 4 天 · 2 人 · 情侣浪漫。行程已规划完毕。"
      />,
    );
    const complete = document.body.querySelector('[data-testid="plan-thread-complete"]');
    expect(complete).toBeTruthy();
    expect(complete!.className).toContain("bubble--agent-notice");
    expect(complete!.className).toContain("plan-nav__complete-bubble");
    expect(complete!.textContent).toContain("行程已规划完毕");
  });
});

describe("T3 hydrate thread (ADR-071 replan-only)", () => {
  it("should_not_show_retired_greeting_or_composer_when_planCompleteLine", () => {
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
    expect(document.body.querySelector('[data-testid="plan-nav-greeting"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-thread-complete"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="plan-nav-input"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-refine-user"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-soft-replan"]')).toBeTruthy();
  });
});
