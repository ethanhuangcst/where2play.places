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
    if (key === "play.plan.transit.or") return "or";
    if (key === "play.plan.transit.options_join") return `, ${vars?.or} `;
    if (key === "play.plan.highlights_label") return "Highlights";
    if (key === "play.plan.day_n") return `Day ${vars?.n}`;
    return key;
  };

  it("should_map_stop_display_to_place_slot_with_stay_origin", () => {
    const tOrigin = (key: string, vars?: Record<string, string>) => {
      if (key === "play.plan.origin_stop") return vars?.name ? `Origin · ${vars.name}` : "Origin";
      return t(key, vars);
    };
    const slot = mapStopDisplayToPlaceSlot(
      {
        stop: { name: "Hotel", kind: "stay", card: null, deeplinks: {} },
        slot: { start: "09:00", end: "09:00" },
        legs_to_here: [],
      },
      tOrigin,
    );
    expect(slot.placeKind).toBe("stay");
    expect(slot.start).toBe("09:00");
    expect(slot.name).toBe("Origin · Hotel");
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

  it("should_join_remaining_legs_with_or_separator (TC-M23-88)", () => {
    const tDual = (key: string, vars?: Record<string, string>) => {
      if (key === "play.plan.transit.mode.transit") return "Transit";
      if (key === "play.plan.transit.mode.drive") return "Drive";
      if (key === "play.plan.transit.line") return `${vars?.mode} · about ${vars?.minutes} min`;
      if (key === "play.plan.transit.or") return "or";
      if (key === "play.plan.transit.options_join") return `, ${vars?.or} `;
      return key;
    };
    const transit = mapLegsToTransitSlot(
      [
        { mode: "transit", duration_min: 35, recommended: true },
        { mode: "drive", duration_min: 15, recommended: false },
      ],
      tDual,
    );
    expect(transit?.text).toContain("Transit");
    expect(transit?.text).toContain("35");
    expect(transit?.text).toContain("Drive");
    expect(transit?.text).toContain("15");
    expect(transit?.text).toMatch(/or/);
  });

  it("should_hide_absurd_legs_in_ui_map (TC-M23-91)", () => {
    const tFilter = (key: string, vars?: Record<string, string>) => {
      if (key === "play.plan.transit.mode.walk") return "Walk";
      if (key === "play.plan.transit.mode.transit") return "Transit";
      if (key === "play.plan.transit.mode.drive") return "Drive";
      if (key === "play.plan.transit.line") return `${vars?.mode} · about ${vars?.minutes} min`;
      if (key === "play.plan.transit.or") return "or";
      if (key === "play.plan.transit.options_join") return `, ${vars?.or} `;
      return key;
    };
    const transit = mapLegsToTransitSlot(
      [
        { mode: "walk", duration_min: 90, recommended: true },
        { mode: "transit", duration_min: 200, recommended: false },
        { mode: "drive", duration_min: 25, recommended: false },
      ],
      tFilter,
    );
    expect(transit?.text).toContain("25");
    expect(transit?.text).not.toContain("90");
    expect(transit?.text).not.toContain("200");
  });

  it("should_label_am_pm_visit_parts", () => {
    const tVisit = (key: string, vars?: Record<string, string>) => {
      if (key === "play.plan.visit_part_am") return `${vars?.name} (morning)`;
      if (key === "play.plan.visit_part_pm") return `${vars?.name} (afternoon)`;
      return key;
    };
    const am = mapStopDisplayToPlaceSlot(
      { stop: { name: "Torre", kind: "attraction" }, slot: { start: "10:00", end: "10:45" } },
      tVisit,
      { visit_part: "am" },
    );
    expect(am.name).toBe("Torre (morning)");
  });

  it("should_build_skeleton_day_highlights", () => {
    const h = skeletonDayHighlights(2, "Belém", t);
    expect(h.label).toBe("Highlights");
    expect(h.title).toBe("Belém");
  });

  it("should_stamp_photo_and_ids_from_pool_when_card_null (24-P0-ui-C-fix)", () => {
    const slot = mapStopDisplayToPlaceSlot(
      {
        stop: { name: "Belém Tower", kind: "attraction", card: null },
        slot: { start: "10:00", end: "11:00" },
      },
      t,
      {
        pool: {
          places: [
            {
              name: "Belém Tower",
              provider: "google",
              photos: ["https://cdn.example/tower.jpg"],
              sources: [{ provider: "google", native_id: "ChIJtower" }],
            },
          ],
        },
      },
    );
    expect(slot.photoUrl).toBe("https://cdn.example/tower.jpg");
    expect(slot.provider).toBe("google");
    expect(slot.nativeId).toBe("ChIJtower");
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
