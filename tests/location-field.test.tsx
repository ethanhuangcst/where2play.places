/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { LocationField } from "@/src/ui/location-field";

function LocationHarness({
  onResolved,
  onResolveFailed,
}: {
  onResolved?: (label: string, lat: number, lng: number) => void;
  onResolveFailed?: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <LocationField
      value={value}
      onChange={setValue}
      onResolved={onResolved}
      onResolveFailed={onResolveFailed}
      testId="field-location"
    />
  );
}

describe("LocationField manual forward geocode", () => {
  const getCurrentPosition = vi.fn();

  beforeEach(() => {
    getCurrentPosition.mockReset();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            lat: 31.23,
            lng: 121.47,
            city: "上海",
            country: "中国",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("should_not_call_geolocation_on_mount", () => {
    renderWithLocale(<LocationHarness />, "CN");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(document.querySelector(".location-detect")).toBeNull();
  });

  it("should_forward_geocode_on_blur_and_call_onResolved", async () => {
    const onResolved = vi.fn();
    const { getByTestId } = renderWithLocale(
      <LocationHarness onResolved={onResolved} />,
      "CN",
    );
    const input = getByTestId("field-location") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "上海" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith("上海", 31.23, 121.47);
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/geocode",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    const body = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(body.query).toBe("上海");
    expect(body.locale).toBe("CN");
    expect(input.value).toBe("上海");
  });

  it("should_call_onResolveFailed_when_geocode_fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const onResolveFailed = vi.fn();
    const onResolved = vi.fn();
    const { getByTestId } = renderWithLocale(
      <LocationHarness onResolved={onResolved} onResolveFailed={onResolveFailed} />,
      "CN",
    );
    const input = getByTestId("field-location") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzz" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onResolveFailed).toHaveBeenCalled();
    });
    expect(onResolved).not.toHaveBeenCalled();
    expect(input.value).toBe("zzz");
    expect(getByTestId("location-hint").textContent).toMatch(/无法解析|Could not resolve/);
  });
});
