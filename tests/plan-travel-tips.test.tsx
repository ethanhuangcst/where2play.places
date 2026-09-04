/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlanTravelTipsPanel } from "@/src/ui/plan-travel-tips-panel";

describe("TC-M10-46-10 plan-travel-tips", () => {
  it("should_render_four_cards_and_fold_toggle", () => {
    const { getByTestId, container } = renderWithLocale(
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

    const toggle = getByTestId("plan-travel-tips-toggle");
    const body = container.querySelector("#travel-tips-body") as HTMLElement;
    expect(body.hidden).toBe(false);
    fireEvent.click(toggle);
    expect(body.hidden).toBe(true);
  });
});
