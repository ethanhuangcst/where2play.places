import { describe, expect, it } from "vitest";
import {
  deviationFieldLabel,
  hydrateFromAgentSkeleton,
  t3ProgressStepStates,
} from "../src/core/plan-t3-hydrate";

describe("plan-t3-hydrate", () => {
  it("should_map_agent_skeleton_to_preview_days", () => {
    const hydrated = hydrateFromAgentSkeleton(
      {
        destination: "Lisbon",
        days: 2,
        startDate: "2026-10-10",
        partySize: 2,
        budget: "mid",
        tripType: "couple",
      },
      {
        days: [
          {
            day_index: 1,
            day_theme: "Belém",
            stops: [
              { name: "Hotel", kind: "stay" },
              { name: "Tower", kind: "place" },
            ],
          },
        ],
      },
      (k) => k,
    );
    expect(hydrated?.skeletonDays).toHaveLength(1);
    expect(hydrated?.skeletonDays[0]?.stops.map((s) => s.name)).toEqual(["Hotel", "Tower"]);
    expect(hydrated?.itinerary.days).toHaveLength(1);
    expect(hydrated?.deviations).toEqual([]);
  });

  it("should_pass_through_skeleton_deviations", () => {
    const hydrated = hydrateFromAgentSkeleton(
      {
        destination: "Lisbon",
        days: 3,
        startDate: "2026-10-10",
        partySize: 2,
        budget: "mid",
        tripType: "couple",
      },
      {
        days: [
          {
            day_index: 1,
            day_theme: "Belém",
            stops: [{ name: "Tower", kind: "place" }],
          },
        ],
        deviations: [
          {
            field: "attraction_pool",
            expected: ">= 3 attractions for 3 days",
            actual: "1",
            reason: "insufficient grounded attractions for requested trip length",
          },
        ],
      },
      (k) => k,
    );
    expect(hydrated?.deviations).toEqual([
      {
        field: "attraction_pool",
        expected: ">= 3 attractions for 3 days",
        actual: "1",
        reason: "insufficient grounded attractions for requested trip length",
      },
    ]);
  });

  it("should_localize_known_deviation_fields", () => {
    expect(deviationFieldLabel("far_cluster", (k) => k)).toBe(
      "play.plan.deviation_field.far_cluster",
    );
    expect(deviationFieldLabel("custom_x", (k) => k)).toBe("custom_x");
  });

  it("should_mark_progress_steps_from_phase_list", () => {
    const steps = t3ProgressStepStates([
      { phase: "trip_created" },
      { phase: "skeleton_generating" },
    ]);
    expect(steps.map((s) => s.id)).toEqual(["skeleton_generating", "skeleton_ready"]);
    expect(steps.find((s) => s.id === "skeleton_generating")?.state).toBe("current");
    expect(steps.find((s) => s.id === "skeleton_ready")?.state).toBe("pending");
  });

  it("should_clear_generating_current_when_failed", () => {
    const steps = t3ProgressStepStates(
      [{ phase: "trip_created" }, { phase: "skeleton_generating" }],
      { failed: true },
    );
    expect(steps.find((s) => s.id === "skeleton_generating")?.state).toBe("done");
    expect(steps.find((s) => s.id === "skeleton_ready")?.state).toBe("pending");
  });

  it("should_omit_trip_created_from_visible_steps", () => {
    const steps = t3ProgressStepStates([{ phase: "trip_created" }]);
    expect(steps.map((s) => s.id)).toEqual(["skeleton_generating", "skeleton_ready"]);
    expect(steps.find((s) => s.id === "skeleton_generating")?.state).toBe("current");
  });
});
