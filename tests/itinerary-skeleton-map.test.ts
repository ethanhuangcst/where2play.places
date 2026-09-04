import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mapLegsToTransitSlot,
  mapStopDisplayToPlaceSlot,
  skeletonDayHighlights,
} from "../src/core/itinerary-skeleton-map";

describe("itinerary-skeleton-map (TC-M10-46-03)", () => {
  const t = (key: string, vars?: Record<string, string>) => {
    if (key === "play.plan.transit.mode.walk") return "Walk";
    if (key === "play.plan.transit.line") return `${vars?.mode} · about ${vars?.minutes} min`;
    if (key === "play.plan.highlights_label") return "Highlights";
    if (key === "play.plan.day_n") return `Day ${vars?.n}`;
    return key;
  };

  it("should_map_stop_display_to_place_slot_with_stay_origin", () => {
    const slot = mapStopDisplayToPlaceSlot(
      {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs_to_here: [],
      },
      t,
    );
    expect(slot.placeKind).toBe("stay");
    expect(slot.start).toBe("09:00");
  });

  it("should_map_legs_to_transit_single_line", () => {
    const transit = mapLegsToTransitSlot(
      [{ mode: "walk", duration_min: 12, recommended: true }],
      t,
    );
    expect(transit?.kind).toBe("transit");
    expect(transit?.text).toContain("Walk");
    expect(transit?.text).toContain("12");
  });

  it("should_build_skeleton_day_highlights", () => {
    const h = skeletonDayHighlights(2, "Belém", t);
    expect(h.label).toBe("Highlights");
    expect(h.title).toBe("Belém");
  });
});

describe("plan-skeleton-fill (TC-M10-46-01)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should_default_pipeline_to_skeleton", async () => {
    const mod = await import("../src/core/plan-skeleton-fill");
    expect(mod.planPipelineMode()).toBe("skeleton");
  });
});
