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

  it("should_show_visa_link_and_popover_from_artifacts_visa", () => {
    const { getByTestId, container } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={2}
        data={{
          visa: {
            passport: "CHN",
            destination: "PRT",
            requirement: "visa_required",
            description: "Apply for Schengen before travel.",
          },
          intro: "Hilly Atlantic port city.",
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    const link = getByTestId("plan-visa-link");
    expect(link.tagName).toBe("A");
    expect(link.textContent).toBe("中国护照 · 葡萄牙 · 需要签证");
    const popover = container.querySelector(".travel-tips-popover");
    expect(popover?.classList.contains("travel-tips-popover--roomy")).toBe(true);
    expect(popover?.querySelector("strong")?.textContent).toBe("需要签证");
    expect(popover?.querySelector(".travel-tips-popover__src")?.textContent).toBe(
      "数据来源 · Orizn Visa",
    );
    expect(popover?.textContent).toContain("Apply for Schengen before travel.");
    expect(getByTestId("travel-tips-card-01").querySelector("h3")?.textContent).toBe("目的地");
  });

  it("should_render_orizn_lists_and_facts_in_visa_popover", () => {
    const { getByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={2}
        data={{
          visa: {
            passport: "CHN",
            destination: "PRT",
            requirement: "visa_required",
            description: "Apply for Schengen before travel.",
            documents: ["Valid passport"],
            process: ["Book VAC appointment"],
            processing_time: "10–15 working days",
            source_url: "https://vistos.mne.gov.pt/",
            last_verified: "2026-05-10",
          },
          intro: "Hilly Atlantic port city.",
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    const popover = getByTestId("plan-visa-popover");
    expect(popover.textContent).toContain("所需材料");
    expect(popover.textContent).toContain("Valid passport");
    expect(popover.textContent).toContain("办理步骤");
    expect(popover.textContent).toContain("Book VAC appointment");
    expect(popover.textContent).toContain("10–15 working days");
    const sourceLink = popover.querySelector("a.travel-tips-popover__src-link");
    expect(sourceLink?.getAttribute("href")).toBe("https://vistos.mne.gov.pt/");
    expect(sourceLink?.textContent).toContain("vistos.mne.gov.pt");
  });

  it("should_show_nationality_notice_and_profile_link_without_visa_link", () => {
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={2}
        data={{
          intro: "Hilly Atlantic port city.",
          visa_notice: {
            key: "play.plan.travel_tips_visa_need_nationality",
            href: "/profile",
          },
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    expect(queryByTestId("plan-visa-link")).toBeNull();
    expect(getByTestId("plan-visa-notice").textContent).toContain("护照国籍");
    const profile = getByTestId("plan-visa-nationality-link");
    expect(profile.getAttribute("href")).toBe("/profile");
    expect(profile.textContent).toBe("打开个人资料");
  });

  it("should_show_unavailable_notice_without_a_visa_link", () => {
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Lisbon"
        startDate="2026-09-20"
        days={2}
        data={{
          intro: "Hilly Atlantic port city.",
          visa_notice: { key: "play.plan.travel_tips_visa_unavailable" },
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    expect(queryByTestId("plan-visa-link")).toBeNull();
    expect(queryByTestId("plan-visa-nationality-link")).toBeNull();
    expect(getByTestId("plan-visa-notice").textContent).toContain("请勿将其视为免签");
    expect(getByTestId("plan-visa-notice").textContent).not.toContain("需要签证");
  });

  it("should_hide_visa_link_for_same_iso_home_country", () => {
    const { queryByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Beijing"
        startDate="2026-09-20"
        days={2}
        data={{
          intro: "Domestic trip.",
          visa: {
            passport: "CHN",
            destination: "CHN",
            requirement: "not_applicable",
            description: "Home country.",
          },
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    expect(queryByTestId("plan-visa-link")).toBeNull();
    expect(queryByTestId("plan-visa-notice")).toBeNull();
  });

  it("should_show_visa_free_singapore_link_with_days_in_label", () => {
    const { getByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Singapore"
        startDate="2026-09-20"
        days={2}
        data={{
          intro: "City state.",
          visa: {
            passport: "CHN",
            destination: "SGP",
            requirement: "visa_free",
            visa_free_days: 30,
            description: "Up to 30 days.",
          },
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    const link = getByTestId("plan-visa-link");
    expect(link.textContent).toContain("免签");
    expect(link.textContent).toContain("30");
    expect(link.textContent).not.toMatch(/入境卡|Arrival Card|SGAC/i);
  });

  it("should_show_special_entry_for_chn_to_hkg", () => {
    const { getByTestId } = renderWithLocale(
      <PlanTravelTipsPanel
        destination="Hong Kong"
        startDate="2026-09-20"
        days={2}
        data={{
          intro: "SAR.",
          visa: {
            passport: "CHN",
            destination: "HKG",
            requirement: "special",
            description: "Exit-entry Permit required.",
          },
        }}
        loading={false}
        errorKey={null}
      />,
      "CN",
    );
    expect(getByTestId("plan-visa-link").textContent).toContain("特殊通行证件");
    expect(getByTestId("plan-visa-popover").textContent).toContain("Exit-entry Permit");
  });
});
