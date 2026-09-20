/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlanTravelTipsPanel } from "@/src/ui/plan-travel-tips-panel";

afterEach(() => {
  cleanup();
});

describe("TC-M10-46-10 / 2play-plan-90d plan-travel-tips", () => {
  it("should_render_four_cards_and_fold_toggle", () => {
    const { getByTestId, container, queryByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={4}
        data={{
          intro: "Hilly Atlantic port city.",
          iconic_places: ["Belém Tower"],
          transit: "Metro and trams.",
          clothing: "Light layers.",
          safety: "Watch pickpockets.",
        }}
        loading={false}
        errorKey={null}
      />,
    );

    expect(getByTestId("plan-travel-tips")).toBeTruthy();
    expect(container.querySelectorAll(".travel-tips-card")).toHaveLength(4);
    expect(getByTestId("travel-tips-card-01")).toBeTruthy();
    expect(queryByTestId("plan-visa-link")).toBeNull();

    const toggle = getByTestId("plan-travel-tips-toggle");
    const body = container.querySelector("#travel-tips-body") as HTMLElement;
    expect(body.hidden).toBe(false);
    fireEvent.click(toggle);
    expect(body.hidden).toBe(true);
  });

  it("should_dedupe_iconic_places_so_list_keys_stay_unique", () => {
    const { container } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="大同"
        startDate="2026-09-20"
        days={3}
        data={{
          iconic_places: ["华严寺塔", "华严寺塔", "云冈石窟"],
        }}
        loading={false}
        errorKey={null}
      />,
    );

    const items = container.querySelectorAll(".travel-tips-must-see li");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe("华严寺塔");
    expect(items[1]?.textContent).toBe("云冈石窟");
  });

  it("should_show_unavailable_empty_state_and_hide_visa_when_absent", () => {
    const { getByTestId, queryByTestId, container } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={2}
        data={{}}
        loading={false}
        errorKey={null}
      />,
    );

    const panel = getByTestId("plan-travel-tips");
    expect(panel.querySelector('[data-testid="travel-tips-card-01"]')).toBeTruthy();
    expect(queryByTestId("plan-visa-link")).toBeNull();
    expect(container.querySelector(".travel-tips-must-see")).toBeNull();
    expect(panel.querySelector('[data-testid="travel-tips-card-03"]')?.textContent).toContain(
      "Not available",
    );
  });

  it("should_show_visa_link_only_when_visa_label_set", () => {
    const { getByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={2}
        data={{ visa_label: "CN · PT visa", visa_detail: "Schengen" }}
        loading={false}
        errorKey={null}
      />,
    );
    expect(getByTestId("plan-visa-link").textContent).toBe("CN · PT visa");
  });
});
