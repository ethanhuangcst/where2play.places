/**
 * @vitest-environment jsdom
 * T3 thread rehydrate after refresh (2play-thread-hydrate).
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import PlanPageClient from "@/src/ui/plan-page";
import type { ItineraryDto } from "@/src/core/itinerary-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const authJson = vi.fn();
const authNdjsonEvents = vi.fn();

vi.mock("@/src/ui/auth-api", () => ({
  authJson: (...args: unknown[]) => authJson(...args),
  authNdjsonEvents: (...args: unknown[]) => authNdjsonEvents(...args),
  AuthApiError: class AuthApiError extends Error {
    key: string;
    constructor(key: string) {
      super(key);
      this.key = key;
    }
  },
}));

function filledItinerary(): ItineraryDto {
  return {
    title: "上海",
    destination: "上海",
    daysCount: 3,
    updatedAt: new Date().toISOString(),
    days: [
      {
        dayIndex: 1,
        highlights: { label: "D1", title: "Day 1", tags: [] },
        slots: [
          {
            kind: "place",
            start: "09:00",
            end: "11:00",
            placeKind: "Attraction",
            name: "乐高探索中心",
            summary: "",
          },
        ],
      },
    ],
  };
}

describe("plan-page T3 hydrate after refresh", () => {
  beforeEach(() => {
    document.body.className = "shell-app";
    document.body.dataset.style = "travor";
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return {
          ok: true,
          criteria: {
            destination: "上海",
            days: 3,
            startDate: "2026-10-01",
            partySize: 2,
            budget: "mid",
            tripType: "couple_romance",
            pace: "medium",
            transport: "transit_walk",
            locale: "CN",
            tripId: "trip-hydrate-1",
            revision: 5,
            dailyStart: "上海虹桥中心爱琴海亚朵S酒店",
          },
          itinerary: filledItinerary(),
        };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
    localStorage.removeItem("w2p.chat.draft.session");
  });

  it("should_restore_t3_complete_line_without_composer_or_refine_after_refresh", async () => {
    renderWithLocale(<PlanPageClient />, "CN");
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-thread-complete"]')).toBeTruthy();
    });
    expect(document.body.querySelector('[data-testid="plan-nav-greeting"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-intake-answer-b"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-input"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-refine-user"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-thread-fill-timeline"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="plan-nav-soft-replan"]')).toBeTruthy();
  });
});
