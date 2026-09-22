/**
 * @vitest-environment jsdom
 * Story 26 — Saved detail readonly chat snapshot.
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import SavedDetailPage from "@/src/ui/saved-detail-page";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import { t } from "@/src/i18n/catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "saved-26" }),
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

describe("saved-detail chat snapshot (Story 26)", () => {
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

  it("should_show_readonly_chat_when_messages_present", async () => {
    authJson.mockResolvedValue({
      itinerary,
      title: "London 2 days",
      savedAt: "2026-09-20T00:00:00.000Z",
      messages: [
        { role: "user", content: "West End hotel" },
        { role: "assistant", content: "Planning your London days…" },
        { role: "system", content: "— replan divider —" },
      ],
    });

    renderWithLocale(<SavedDetailPage />, "EN");
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="saved-chat-snapshot"]')).toBeTruthy();
    });
    expect(document.body.textContent).toContain(t("EN", "play.saved.chat_snapshot_note"));
    expect(document.body.textContent).toContain(t("EN", "play.saved.chat_continue_note"));
    expect(document.body.textContent).toContain("West End hotel");
    expect(document.body.textContent).toContain("Planning your London days…");
    expect(document.body.querySelectorAll('[data-testid="saved-chat-message"]')).toHaveLength(3);
    expect(document.body.querySelector("textarea, input[type='text']")).toBeNull();
  });

  it("should_hide_chat_panel_when_messages_empty", async () => {
    authJson.mockResolvedValue({
      itinerary,
      title: "London 2 days",
      savedAt: "2026-09-20T00:00:00.000Z",
      messages: [],
    });

    renderWithLocale(<SavedDetailPage />, "EN");
    await waitFor(() => {
      expect(document.body.textContent).toContain("British Museum");
    });
    expect(document.body.querySelector('[data-testid="saved-chat-snapshot"]')).toBeNull();
  });
});
