/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { buildConstraintItems, intakeAnswersFromAgentNeeds } from "@/src/core/plan-intake";
import { t } from "@/src/i18n/catalog";
import { renderWithLocale } from "./render-with-locale";
import { PlanConstraintsPanel } from "@/src/ui/plan-constraints-panel";

describe("TC-M10-46-09 plan-constraints", () => {
  afterEach(() => {
    cleanup();
  });

  const tt = (key: string) => t("EN", key);
  const takeoff = {
    destination: "Lisbon",
    startDate: "2026-09-20",
    days: 4,
    partySize: 2,
    budget: "$$ Mid-range",
  };

  it("should_show_dash_for_unanswered_assistant_fields", () => {
    const items = buildConstraintItems(
      takeoff,
      { b: "Hotel Lisboa", c: "09:00" },
      tt,
      false,
    );
    const pace = items.find((i) => i.key === "pace");
    expect(pace?.value).toBeNull();
    const { container } = renderWithLocale(<PlanConstraintsPanel items={items} />);
    expect(container.querySelector('[data-testid="plan-constraints"]')).toBeTruthy();
    expect(container.textContent).toContain("—");
  });

  it("should_show_takeoff_trip_type_before_intake_complete", () => {
    const items = buildConstraintItems(
      { ...takeoff, tripType: "couple_romance", pace: "medium", transit: "transit_walk" },
      {},
      tt,
      false,
    );
    expect(items.find((i) => i.key === "tripType")?.value).toBe(
      t("EN", "play.plan.trip_type.couple_romance"),
    );
    expect(items.find((i) => i.key === "tripType")?.pending).toBe(false);
    expect(items.find((i) => i.key === "hotel")?.pending).toBe(true);
  });

  it("should_order_takeoff_prefs_before_intake_fields_like_mockup", () => {
    const items = buildConstraintItems(
      {
        ...takeoff,
        tripType: "couple_romance",
        pace: "medium",
        transit: "transit_walk",
      },
      {},
      tt,
      false,
    );
    expect(items.map((i) => i.key)).toEqual([
      "destination",
      "startDate",
      "days",
      "partySize",
      "tripType",
      "budget",
      "pace",
      "transport",
      "hotel",
      "dayStart",
      "mustSee",
      "other",
    ]);
    expect(items.find((i) => i.key === "pace")?.value).toBe(t("EN", "play.plan.pace.medium"));
    expect(items.find((i) => i.key === "transport")?.value).toBe(
      t("EN", "play.plan.transit.transit_walk"),
    );
    expect(items.find((i) => i.key === "transport")?.value).not.toBe("公共交通+步行");
    expect(items.find((i) => i.key === "hotel")?.pending).toBe(true);
  });

  it("should_fill_hotel_and_must_see_from_agent_need_answers", () => {
    const fromNeeds = intakeAnswersFromAgentNeeds({
      hotel: "SFEEL设计师酒店",
      start_time: "",
      must_see: "断桥残雪、白堤",
      other: "",
    });
    const items = buildConstraintItems(
      { ...takeoff, pace: "medium", transit: "drive_walk", tripType: "city" },
      fromNeeds,
      (key) => t("CN", key),
      true,
    );
    expect(items.find((i) => i.key === "hotel")?.value).toBe("SFEEL设计师酒店");
    expect(items.find((i) => i.key === "mustSee")?.value).toBe("断桥残雪、白堤");
    expect(items.find((i) => i.key === "mustSee")?.chips).toEqual(["断桥残雪", "白堤"]);
    expect(items.find((i) => i.key === "mustSee")?.pending).toBe(false);
    expect(items.find((i) => i.key === "pace")?.value).toBe(t("CN", "play.plan.pace.medium"));
  });

  it("TC-M20-41-02 should_mark_must_see_pending_without_poi_names", () => {
    const items = buildConstraintItems(
      takeoff,
      {},
      tt,
      false,
      ["Belém Tower"],
    );
    const { getByTestId } = renderWithLocale(<PlanConstraintsPanel items={items} />);
    const mustSee = getByTestId("constraint-must-see");
    expect(mustSee.classList.contains("constraint-item__pending")).toBe(true);
    expect(mustSee.textContent).toBe(t("EN", "play.plan.constraint_pending"));
    expect(mustSee.textContent).not.toContain("Belém");
  });

  it("should_show_all_twelve_fields_when_complete", () => {
    const items = buildConstraintItems(
      takeoff,
      {
        b: "",
        c: "09:00",
        d: tt("play.plan.trip_type.city"),
        e: tt("play.plan.pace.medium"),
        f: tt("play.plan.transport.metro_walk"),
        g: "",
        h: "",
      },
      tt,
      true,
    );
    expect(items).toHaveLength(12);
    expect(items.every((i) => i.value != null)).toBe(true);
  });

  it("should_render_takeoff_and_intake_as_two_four_column_grids", () => {
    const items = buildConstraintItems(
      { ...takeoff, tripType: "couple_romance", pace: "medium", transit: "transit_walk" },
      { b: "Hotel Lisboa", c: "07:00", g: "Belém Tower、Jerónimos" },
      tt,
      false,
    );
    const { container, getByTestId } = renderWithLocale(<PlanConstraintsPanel items={items} />);
    const grids = container.querySelectorAll(".constraint-grid");
    expect(grids).toHaveLength(2);
    expect(grids[1]?.classList.contains("constraint-grid--intake")).toBe(true);
    expect(grids[0]?.querySelectorAll(".constraint-item")).toHaveLength(8);
    expect(grids[1]?.querySelectorAll(".constraint-item")).toHaveLength(4);
    const chips = getByTestId("constraint-must-see").querySelectorAll(".chip");
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });
});
