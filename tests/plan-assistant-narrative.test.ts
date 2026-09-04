import { describe, expect, it } from "vitest";
import {
  appendAssistantLine,
  createPlanNarrativeContext,
  narrativeFromPlanEvent,
  narrativeLinesForIntakeComplete,
} from "../src/core/plan-assistant-narrative";

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === "play.plan.constraint_none") return "None";
  if (key === "play.plan.assistant_plan_complete" && vars) {
    return `${vars.destination} · ${vars.days} days · ${vars.party} people · ${vars.tripType}. done`;
  }
  if (vars) {
    let text = key;
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
    return text;
  }
  return key;
};

describe("plan-assistant-narrative (TC-M19-40-03)", () => {
  it("should_append_intake_complete_lines_in_order", () => {
    const ctx = createPlanNarrativeContext({
      t,
      destination: "Lisbon",
      days: 2,
      partySize: 2,
      tripType: "Couple",
    });
    const lines = narrativeLinesForIntakeComplete(ctx);
    expect(lines).toEqual(["play.plan.assistant_planning_skeleton"]);
  });

  it("should_skip_discovering_after_making_has_started", () => {
    const ctx = createPlanNarrativeContext({
      t,
      destination: "Lisbon",
      days: 2,
      partySize: 2,
      tripType: "Couple",
    });
    const lines = appendAssistantLine(
      narrativeLinesForIntakeComplete(ctx),
      "play.plan.assistant_making",
    );
    const after = narrativeFromPlanEvent({ type: "phase", phase: "discovering" }, ctx, lines);
    expect(after.lines).toEqual(lines);
  });

  it("should_not_append_duplicate_consecutive_lines", () => {
    const once = appendAssistantLine([], "same");
    const twice = appendAssistantLine(once, "same");
    expect(twice).toEqual(["same"]);
  });

  it("should_narrate_skeleton_days_before_skeleton_ready_then_fill_then_done", () => {
    let ctx = createPlanNarrativeContext({
      t,
      destination: "Lisbon",
      days: 2,
      partySize: 2,
      tripType: "Couple",
    });
    let lines = appendAssistantLine(
      narrativeLinesForIntakeComplete(ctx),
      "play.plan.assistant_making",
    );

    ({ lines, ctx } = narrativeFromPlanEvent(
      {
        type: "skeleton_day",
        dayIndex: 1,
        theme: "Belém",
        stops: [
          { name: "Hotel", kind: "stay" },
          { name: "Tower", kind: "attraction" },
        ],
      },
      ctx,
      lines,
    ));
    ({ lines, ctx } = narrativeFromPlanEvent({ type: "skeleton_done" }, ctx, lines));

    const skeletonReadyIdx = lines.indexOf("play.plan.assistant_skeleton_ready");
    const towerIdx = lines.indexOf("Tower");
    expect(skeletonReadyIdx).toBeGreaterThan(towerIdx);

    ({ lines, ctx } = narrativeFromPlanEvent(
      { type: "stop_filled", slot: { name: "Tower" } },
      ctx,
      lines,
    ));
    expect(lines.some((l) => l.includes("Tower"))).toBe(true);

    ({ lines } = narrativeFromPlanEvent({ type: "done" }, ctx, lines));
    expect(lines.at(-1)).toContain("Lisbon");
    expect(lines.at(-1)).toContain("2 days");
  });
});
