/**
 * @vitest-environment jsdom
 * Trip type combo: allow clearing default while typing (no auto-refill until blur).
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { LocaleProvider } from "@/src/i18n/locale-provider";
import { PlanCombo } from "@/src/ui/plan-combo";
import {
  tripTypeStorageValue,
  formatTripTypeDisplay,
  DEFAULT_TAKEOFF_TRIP_TYPE,
} from "@/src/core/plan-intake";
import CN from "../messages/CN.json";

function t(key: string) {
  return (CN as Record<string, string>)[key] ?? key;
}

afterEach(() => {
  cleanup();
});

describe("tripTypeStorageValue (edit empty)", () => {
  it("should_keep_empty_string_while_typing_not_force_default", () => {
    expect(tripTypeStorageValue("", t)).toBe("");
    expect(tripTypeStorageValue("   ", t)).toBe("");
  });

  it("should_still_map_preset_labels_to_slug", () => {
    expect(tripTypeStorageValue(t("play.plan.trip_type.couple_romance"), t)).toBe(
      DEFAULT_TAKEOFF_TRIP_TYPE,
    );
    expect(tripTypeStorageValue(t("play.plan.trip_type.family_kids"), t)).toBe(
      "family_kids",
    );
  });
});

function TripTypeHarness() {
  const [tripType, setTripType] = useState(DEFAULT_TAKEOFF_TRIP_TYPE);
  const display =
    formatTripTypeDisplay(tripType, t) ||
    tripType ||
    "";
  return (
    <LocaleProvider initialLocale="CN">
      <PlanCombo
        id="trip_type"
        name="trip_type"
        value={display}
        options={[
          t("play.plan.trip_type.couple_romance"),
          t("play.plan.trip_type.family_kids"),
        ]}
        onChange={(v) => setTripType(tripTypeStorageValue(v, t))}
        onBlurEmpty={() => {
          if (!tripType.trim()) setTripType(DEFAULT_TAKEOFF_TRIP_TYPE);
        }}
        toggleLabel="行程类型"
        required
        testId="plan-trip-type"
      />
      <span data-testid="stored">{tripType}</span>
    </LocaleProvider>
  );
}

describe("plan trip type clear while typing", () => {
  it("should_allow_deleting_all_chars_without_auto_refilling_default", () => {
    const { getByTestId } = render(<TripTypeHarness />);
    const input = getByTestId("plan-trip-type") as HTMLInputElement;
    expect(input.value).toBe(t("play.plan.trip_type.couple_romance"));

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });

    expect(getByTestId("stored").textContent).toBe("");
    expect(input.value).toBe("");

    // Blur with empty restores default (required field).
    fireEvent.blur(input);
    expect(getByTestId("stored").textContent).toBe(DEFAULT_TAKEOFF_TRIP_TYPE);
  });

  it("should_keep_partial_typed_text_without_snapping_to_default", () => {
    const { getByTestId } = render(<TripTypeHarness />);
    const input = getByTestId("plan-trip-type") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "亲" } });
    expect(input.value).toBe("亲");
    expect(getByTestId("stored").textContent).toBe("亲");
  });
});
