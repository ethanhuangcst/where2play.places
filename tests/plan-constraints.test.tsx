/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { buildConstraintItems } from "@/src/core/plan-intake";
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
});
