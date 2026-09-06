/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlaceSheet } from "@/src/ui/place-sheet";
import type { ItineraryPlaceSlot } from "@/src/core/itinerary-types";

const slotWithPhoto: ItineraryPlaceSlot = {
  kind: "place",
  start: "09:00",
  end: "09:00",
  placeKind: "stay",
  name: "Hills Hotel Lisboa",
  summary: "",
  photoUrl: "https://lh3.googleusercontent.com/hotel-thumb",
};

const slotEmpty: ItineraryPlaceSlot = {
  kind: "place",
  start: "10:00",
  end: "11:00",
  placeKind: "attraction",
  name: "Tower",
  summary: "",
};

describe("place-sheet photo lightbox", () => {
  afterEach(() => {
    cleanup();
  });

  it("should_open_lightbox_when_photo_clicked", async () => {
    const onClose = vi.fn();
    const { getByTestId } = renderWithLocale(
      <PlaceSheet open slot={slotWithPhoto} onClose={onClose} dayIndex={1} />,
    );

    fireEvent.click(getByTestId("place-sheet-photo-open"));
    await waitFor(() => {
      expect(getByTestId("place-photo-lightbox")).toBeTruthy();
    });
    expect(getByTestId("place-photo-lightbox-img").getAttribute("src")).toBe(
      slotWithPhoto.photoUrl,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should_close_lightbox_only_on_escape_when_lightbox_open", async () => {
    const onClose = vi.fn();
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlaceSheet open slot={slotWithPhoto} onClose={onClose} />,
    );

    fireEvent.click(getByTestId("place-sheet-photo-open"));
    await waitFor(() => expect(getByTestId("place-photo-lightbox")).toBeTruthy());

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(queryByTestId("place-photo-lightbox")).toBeNull();
    });
    expect(getByTestId("place-sheet")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should_not_render_photo_button_when_no_photo", () => {
    const { queryByTestId, getByTestId } = renderWithLocale(
      <PlaceSheet open slot={slotEmpty} onClose={() => undefined} />,
    );
    expect(getByTestId("place-sheet-photo-empty")).toBeTruthy();
    expect(queryByTestId("place-sheet-photo-open")).toBeNull();
    expect(queryByTestId("place-sheet-photo")).toBeNull();
  });

  it("should_close_lightbox_via_close_button", async () => {
    const { getByTestId, queryByTestId } = renderWithLocale(
      <PlaceSheet open slot={slotWithPhoto} onClose={() => undefined} />,
    );
    fireEvent.click(getByTestId("place-sheet-photo-open"));
    await waitFor(() => expect(getByTestId("place-photo-lightbox")).toBeTruthy());
    fireEvent.click(getByTestId("place-photo-lightbox-close"));
    await waitFor(() => expect(queryByTestId("place-photo-lightbox")).toBeNull());
  });
});

describe("place-sheet CJK display (ADR-052 D9 / Feature 89)", () => {
  afterEach(() => {
    cleanup();
  });

  it("should_keep_cjk_slot_name_when_details_name_is_latin", () => {
    const slot: ItineraryPlaceSlot = {
      kind: "place",
      start: "12:58",
      end: "13:58",
      placeKind: "attraction",
      name: "杭州植物园",
      summary: "",
      provider: "AMAP",
      nativeId: "B0_amap",
    };
    const { getByTestId } = renderWithLocale(
      <PlaceSheet
        open
        slot={slot}
        onClose={() => undefined}
        details={{
          name: "Hangzhou Botanical Garden",
          address: "China, Zhejiang, Hangzhou, Xihu District",
          provider: "GOOGLE_MAPS",
        }}
      />,
    );
    const sheet = getByTestId("place-sheet");
    expect(sheet.textContent).toContain("杭州植物园");
    expect(sheet.textContent).not.toContain("Hangzhou Botanical Garden");
    expect(sheet.textContent).toContain("AMAP");
  });
});
