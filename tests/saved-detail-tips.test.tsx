/**
 * @vitest-environment jsdom
 * 2play-plan-106 — Saved detail hydrates tips when API returns travelTips.
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import SavedDetailPage from "@/src/ui/saved-detail-page";
import type { ItineraryDto } from "@/src/core/itinerary-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "saved-106" }),
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
        },
      ],
    },
  ],
};

describe("saved-detail travel tips hydrate (2play-plan-106)", () => {
  beforeEach(() => {
    document.body.className = "shell-app";
    document.body.dataset.style = "travor";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_show_tips_panel_when_detail_includes_travelTips", async () => {
    authJson.mockResolvedValue({
      itinerary,
      title: "London 2 days",
      savedAt: "2026-09-20T00:00:00.000Z",
      travelTips: {
        intro: "London tips",
        iconic_places: ["British Museum"],
        transit: "Tube",
        clothing: "Layers",
        safety: "Mind the gap",
        weather: { summary: "Mild" },
        visa: {
          passport: "CHN",
          destination: "GBR",
          requirement: "visa_required",
          description: "Visitor visa required.",
        },
      },
    });

    renderWithLocale(<SavedDetailPage />, "EN");
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-travel-tips"]')).toBeTruthy();
    });
    expect(document.body.querySelector('[data-testid="plan-visa-link"]')).toBeTruthy();
    expect(document.body.textContent).toContain("London tips");
  });

  it("should_hide_tips_panel_when_travelTips_absent", async () => {
    authJson.mockResolvedValue({
      itinerary,
      title: "London 2 days",
      savedAt: "2026-09-20T00:00:00.000Z",
    });

    renderWithLocale(<SavedDetailPage />, "EN");
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="saved-detail-page"]')).toBeTruthy();
      expect(document.body.textContent).toContain("British Museum");
    });
    expect(document.body.querySelector('[data-testid="plan-travel-tips"]')).toBeNull();
  });
});
