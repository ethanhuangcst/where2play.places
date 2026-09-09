import { describe, expect, it } from "vitest";
import {
  appendAssistantLine,
  createPlanNarrativeContext,
  narrativeFromPlanEvent,
  narrativeLinesForIntakeComplete,
} from "../src/core/plan-assistant-narrative";

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === "play.plan.constraint_none") return "None";
  if (key === "play.plan.fill_day_heading" && vars) {
    return `Day ${vars.n} — ${vars.theme}`;
  }
  if (key === "play.plan.assistant_plan_complete" && vars) {
    return `${vars.destination} · ${vars.days} days · ${vars.party} people · ${vars.tripType}. done`;
  }
  if (key === "play.plan.assistant_filling_stop" && vars) {
    return `Arranging ${vars.name}`;
  }
  if (key === "play.plan.preview_place" && vars) {
    return `Adding ${vars.name} · ${vars.window}`;
  }
  if (key === "play.plan.preview_transit" && vars) {
    return `Transit ${vars.label} · ${vars.duration}`;
  }
  if (key === "play.plan.preview_meal" && vars) {
    return `Meal ${vars.meal}: ${vars.name}`;
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
    expect(lines).toEqual(["play.plan.assistant_know_enough"]);
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

  it("should_emit_fill_day_heading_then_skeleton_ready_then_fill_then_done (TC-M23-S1)", () => {
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
    expect(lines).toContain("Day 1 — Belém");
    expect(lines).not.toContain("Tower");

    ({ lines, ctx } = narrativeFromPlanEvent({ type: "skeleton_done" }, ctx, lines));
    const skeletonReadyIdx = lines.indexOf("play.plan.assistant_skeleton_ready");
    const dayIdx = lines.indexOf("Day 1 — Belém");
    expect(skeletonReadyIdx).toBeGreaterThan(dayIdx);

    ({ lines, ctx } = narrativeFromPlanEvent(
      { type: "stop_filled", slot: { name: "Tower" } },
      ctx,
      lines,
    ));
    expect(lines.some((l) => l.includes("Tower"))).toBe(true);

    const done = narrativeFromPlanEvent({ type: "done" }, ctx, lines);
    expect(done.lines).toHaveLength(0);
    expect(done.completeLine).toBeTruthy();
    expect(done.completeLine).toContain("Lisbon");
    expect(done.completeLine).toContain("2 days");
    expect(done.completeLine).not.toContain("Day 1");
  });

  it("should_cover_one_fill_progress_line_then_strip_on_done (24-P0-ui-A)", () => {
    let ctx = createPlanNarrativeContext({
      t,
      destination: "Lisbon",
      days: 4,
      partySize: 2,
      tripType: "Couple",
    });
    let lines = narrativeLinesForIntakeComplete(ctx);
    ({ lines, ctx } = narrativeFromPlanEvent({ type: "skeleton_done" }, ctx, lines));

    ({ lines, ctx } = narrativeFromPlanEvent(
      {
        type: "slot_preview",
        kind: "place",
        name: "Castle",
        reason: "skeleton",
        window: "45m",
      },
      ctx,
      lines,
    ));
    ({ lines, ctx } = narrativeFromPlanEvent(
      {
        type: "slot_preview",
        kind: "transit",
        name: "Viewpoint",
        reason: "directions",
        window: "~8 min",
        transportLabel: "walk 8",
      },
      ctx,
      lines,
    ));

    const coverCount = lines.filter(
      (l) => l.includes("Castle") || l.includes("walk 8") || l.startsWith("Transit "),
    ).length;
    expect(coverCount).toBe(1);

    const done = narrativeFromPlanEvent({ type: "done" }, ctx, lines);
    expect(done.lines).toHaveLength(0);
    expect(done.lines.filter((l) => l.startsWith("Adding ") || l.startsWith("Transit "))).toHaveLength(0);
    expect(done.completeLine).toContain("Lisbon");
    expect(done.completeLine).toContain("done");
  });

  it("should_not_stuff_timeline_strings_into_statusLines_on_stop_filled (24-P0-ui-B)", () => {
    let ctx = createPlanNarrativeContext({
      t,
      destination: "Lisbon",
      days: 1,
      partySize: 2,
      tripType: "Couple",
    });
    let lines = ["play.plan.assistant_skeleton_ready"];
    ({ lines, ctx } = narrativeFromPlanEvent(
      {
        type: "slot_preview",
        kind: "place",
        name: "Castle",
        window: "45m",
      },
      ctx,
      lines,
    ));
    expect(lines.some((l) => l.includes("Castle"))).toBe(true);

    ({ lines, ctx } = narrativeFromPlanEvent(
      {
        type: "stop_filled",
        slot: { name: "圣若热城堡", kind: "place" },
        itinerary: {
          title: "",
          destination: "Lisbon",
          daysCount: 1,
          updatedAt: "",
          days: [
            {
              dayIndex: 1,
              highlights: {
                label: "",
                title: "",
                theme: "阿尔法玛与历史中心浪漫漫步",
                tags: [],
              },
              slots: [
                {
                  kind: "place",
                  start: "07:00",
                  end: "07:00",
                  placeKind: "stay",
                  name: "起点 · Hyatt",
                  summary: "",
                },
                {
                  kind: "place",
                  start: "07:45",
                  end: "08:45",
                  placeKind: "attraction",
                  name: "圣若热城堡",
                  summary: "",
                },
              ],
            },
          ],
        },
      },
      ctx,
      lines,
    ));
    expect(lines).not.toContain("阿尔法玛与历史中心浪漫漫步");
    expect(lines.some((l) => l.includes("行程起点"))).toBe(false);
    expect(lines.some((l) => l.includes("Castle"))).toBe(false);
  });
});
