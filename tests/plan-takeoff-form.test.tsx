/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlanTakeoffForm } from "@/src/ui/plan-takeoff-form";

afterEach(() => {
  cleanup();
});

const baseProps = {
  destination: "Lisbon",
  startDate: "2026-09-20",
  days: "3",
  partySize: "2",
  budget: "mid",
  tripType: "couple_romance",
  pace: "medium",
  transit: "transit_walk",
  startTime: "09:00",
  origin: "",
  other: "",
  destVerifiedLabel: "Portugal/Lisbon" as string | null,
  fieldErrors: {},
  originOverlay: null as null,
  submitEnabled: true,
  onDestinationChange: vi.fn(),
  onDestinationBlur: vi.fn(),
  onStartDateChange: vi.fn(),
  onDaysChange: vi.fn(),
  onPartySizeChange: vi.fn(),
  onBudgetChange: vi.fn(),
  onTripTypeChange: vi.fn(),
  onPaceChange: vi.fn(),
  onTransitChange: vi.fn(),
  onStartTimeChange: vi.fn(),
  onOriginChange: vi.fn(),
  onOriginBlur: vi.fn(),
  onOtherChange: vi.fn(),
  onOriginPick: vi.fn(),
  onOriginRetry: vi.fn(),
  onOriginSkip: vi.fn(),
  onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
};

describe("TC-T2-100-01 / TC-T2-100-06 plan-takeoff-form", () => {
  it("should_render_eleven_fields_without_must_see", () => {
    const { getByTestId, container } = renderWithLocale(<PlanTakeoffForm {...baseProps} />);
    expect(getByTestId("plan-takeoff-11")).toBeTruthy();
    expect(getByTestId("plan-takeoff-row-1")).toBeTruthy();
    expect(getByTestId("plan-takeoff-row-2")).toBeTruthy();
    expect(container.querySelectorAll("[data-field]").length).toBe(11);
    expect(container.querySelector('[data-field="must_see"]')).toBeNull();
    expect(container.querySelector('[data-field="cta"]')).toBeNull();
    expect(getByTestId("plan-dest-verified").textContent).toBe("Portugal/Lisbon");
    expect(container.querySelector('.field[data-field="other"]')?.classList.contains("field--other-span")).toBe(
      true,
    );
  });

  it("TC-T2-100-01b should_use_cn_labels_matching_mock", () => {
    const { container } = renderWithLocale(<PlanTakeoffForm {...baseProps} />, "CN");
    const labels = [...container.querySelectorAll(".plan-takeoff--11 label")].map((el) =>
      (el.textContent ?? "").replace(/\s*\*$/, "").trim(),
    );
    expect(labels).toEqual([
      "目的地",
      "行程开始日期",
      "行程类型",
      "天数",
      "人数",
      "行程预算",
      "动线节奏",
      "行程起点",
      "每日出发时间",
      "交通偏好",
      "其他要求",
    ]);
  });

  it("should_disable_submit_when_not_enabled", () => {
    const { getByTestId } = renderWithLocale(
      <PlanTakeoffForm {...baseProps} submitEnabled={false} destVerifiedLabel={null} />,
    );
    expect((getByTestId("plan-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("should_show_origin_candidates_overlay", () => {
    const onPick = vi.fn();
    const { getByTestId, getByText } = renderWithLocale(
      <PlanTakeoffForm
        {...baseProps}
        originOverlay={{
          kind: "candidates",
          query: "Hills",
          destination: "Lisbon",
          cards: [{ name: "Hills Hotel" }, { name: "Hills Hostel" }],
        }}
        onOriginPick={onPick}
      />,
    );
    expect(getByTestId("plan-origin-overlay")).toBeTruthy();
    expect(getByTestId("plan-origin-candidates")).toBeTruthy();
    fireEvent.click(getByText("Hills Hotel"));
    expect(onPick).toHaveBeenCalledWith(0);
  });

  it("should_clear_origin_and_refocus_on_retry", () => {
    const onRetry = vi.fn();
    const { getByTestId } = renderWithLocale(
      <PlanTakeoffForm
        {...baseProps}
        origin="Hyatt"
        focusOriginToken={1}
        originOverlay={{
          kind: "candidates",
          query: "Hyatt",
          destination: "Lisbon",
          cards: [{ name: "Hills Hotel" }],
        }}
        onOriginRetry={onRetry}
      />,
    );
    fireEvent.click(getByTestId("plan-origin-retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("should_mark_required_labels_with_asterisk_class", () => {
    const { container } = renderWithLocale(<PlanTakeoffForm {...baseProps} />);
    expect(container.querySelector('label[for="dest"].is-required')).toBeTruthy();
    expect(container.querySelector('label[for="start_date"].is-required')).toBeTruthy();
    expect(container.querySelector('label[for="origin"].is-required')).toBeNull();
  });

  it("should_pass_live_origin_value_on_blur", () => {
    const onBlur = vi.fn();
    const { getByTestId } = renderWithLocale(
      <PlanTakeoffForm {...baseProps} onOriginBlur={onBlur} />,
    );
    const input = getByTestId("plan-origin") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hyatt" } });
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledWith("Hyatt");
  });

  it("should_not_render_plus_minus_stepper_buttons", () => {
    const { container } = renderWithLocale(<PlanTakeoffForm {...baseProps} />);
    expect(container.querySelector(".plan-stepper")).toBeNull();
    expect(container.querySelector('[data-testid="plan-days-dec"]')).toBeNull();
    expect((container.querySelector('[data-testid="plan-days"]') as HTMLInputElement).type).toBe(
      "number",
    );
  });
});
