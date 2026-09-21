/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { ComboField } from "@/src/ui/combo-field";

function Harness({
  onChangeSpy,
}: {
  onChangeSpy?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <ComboField
      id="nationality"
      testId="register-nationality"
      value={value}
      onChange={(v) => {
        onChangeSpy?.(v);
        setValue(v);
      }}
      options={[
        { value: "CHN", label: "中国" },
        { value: "PRT", label: "Portugal" },
      ]}
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
});
