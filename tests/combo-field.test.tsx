/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { ComboField } from "@/src/ui/combo-field";

const OPTIONS = [
  { value: "CHN", label: "中国" },
  { value: "PRT", label: "Portugal" },
  { value: "USA", label: "United States" },
];

function Harness({
  onChangeSpy,
  initialValue = "",
}: {
  onChangeSpy?: (value: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ComboField
      id="nationality"
      testId="register-nationality"
      value={value}
      onChange={(v) => {
        onChangeSpy?.(v);
        setValue(v);
      }}
      options={OPTIONS}
      placeholder="请选择国家/地区"
      label="Nationality"
      listAriaLabel="countries"
      toggleAriaLabel="toggle"
    />
  );
}

describe("ComboField nationality stick", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should_keep_selection_when_option_clicked_with_empty_query", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = vi.fn();
    const { getByTestId, getAllByTestId } = render(<Harness onChangeSpy={spy} />);

    const input = getByTestId("register-nationality-input") as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.placeholder).toBe("请选择国家/地区");

    const china = getAllByTestId("register-nationality-option").find(
      (el) => el.getAttribute("data-value") === "CHN",
    );
    expect(china).toBeTruthy();
    fireEvent.mouseDown(china!);
    fireEvent.click(china!);

    await act(async () => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("CHN");
      expect(spy).not.toHaveBeenCalledWith("");
    });
    expect(getByTestId("register-nationality").getAttribute("data-value")).toBe("CHN");
    expect(input.value).toBe("中国");
  });

  it("should_show_all_options_when_opened_with_selected_value", async () => {
    const { getByTestId, getAllByTestId } = render(
      <Harness initialValue="CHN" />,
    );

    const input = getByTestId("register-nationality-input") as HTMLInputElement;
    await waitFor(() => {
      expect(input.value).toBe("中国");
    });

    fireEvent.focus(input);

    const values = getAllByTestId("register-nationality-option").map((el) =>
      el.getAttribute("data-value"),
    );
    expect(values).toContain("CHN");
    expect(values).toContain("PRT");
    expect(values).toContain("USA");
  });

  it("should_filter_options_when_query_differs_from_selected_label", async () => {
    const { getByTestId, getAllByTestId, queryAllByTestId } = render(
      <Harness initialValue="CHN" />,
    );

    const input = getByTestId("register-nationality-input") as HTMLInputElement;
    await waitFor(() => {
      expect(input.value).toBe("中国");
    });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Port" } });

    await waitFor(() => {
      const values = getAllByTestId("register-nationality-option").map((el) =>
        el.getAttribute("data-value"),
      );
      expect(values).toEqual(["PRT"]);
    });
    expect(
      queryAllByTestId("register-nationality-option").find(
        (el) => el.getAttribute("data-value") === "USA",
      ),
    ).toBeUndefined();
  });
});
