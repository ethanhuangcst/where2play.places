/**
 * @vitest-environment jsdom
 * Story 37 / AC20 — Saved detail isomorphic with Plan done state.
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import SavedDetailPage from "@/src/ui/saved-detail-page";
import type { ItineraryDto } from "@/src/core/itinerary-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "saved-37" }),
}));

const authJson = vi.fn();

vi.mock("@/src/ui/auth-api", () => ({
  authJson: (...args: unknown[]) => authJson(...args),
  AuthApiError: class AuthApiError extends Error {
    key: string;
    constructor(key: string) {
      super(key);
      this.key = key;
    }
  },
}));

const itinerary: ItineraryDto = {
  title: "London 2 days",
  destination: "London",
  daysCount: 2,
  updatedAt: "2026-08-23T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "Day 1", title: "Explore", tags: [] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "British Museum",
          summary: "Highlights tour",
          provider: "GOOGLE_MAPS",
          nativeId: "ChIJrW8zA9IEdkgRyx0FfpgPADk",
          photoUrl: "https://example.com/museum.jpg",
        },
      ],
    },
  ],
};

describe("saved-detail isomorphic (Story 37 / AC20)", () => {
  beforeEach(() => {
    document.body.className = "shell-app";
    document.body.dataset.style = "travor";
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (String(url).startsWith("/api/itineraries/")) {
        return {
          itinerary,
          title: "London 2 days",
          savedAt: "2026-09-20T00:00:00.000Z",
          destination: "London",
          daysCount: 2,
          startDate: "2026-11-08",
        };
      }
      if (String(url).startsWith("/api/places/")) {
        return {
          ok: true,
          data: {
            name: "British Museum",
            address: "Great Russell St",
            summary: "Highlights tour",
            photos: ["https://example.com/museum.jpg"],
          },
        };
      }
      throw new Error(`unexpected authJson url: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_show_constraints_and_panel_head_actions_when_detail_loads", async () => {
    renderWithLocale(<SavedDetailPage />, "EN");
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-constraints"]')).toBeTruthy();
    });
    expect(document.body.querySelector('[data-testid="plan-itinerary"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="saved-back-head"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="plan-export"]')).not.toBeDisabled();
    expect(document.body.querySelector('[data-testid="saved-unsave"]')).toBeTruthy();
    // Footer duplicate actions removed
    expect(document.body.querySelector(".saved-detail-actions")).toBeNull();
  });

  it("should_fetch_place_details_when_opening_place_sheet", async () => {
    renderWithLocale(<SavedDetailPage />, "EN");
    await waitFor(() => {
      expect(document.body.textContent).toContain("British Museum");
    });
    const openBtn = document.body.querySelector('[data-testid="stop-detail-open"]');
    expect(openBtn).toBeTruthy();
    fireEvent.click(openBtn!);
    await waitFor(() => {
      expect(
        authJson.mock.calls.some((c) => String(c[0]).includes("/api/places/GOOGLE_MAPS/")),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain("Great Russell St");
    });
  });
});
