/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import PlanPageClient from "@/src/ui/plan-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const authNdjsonEvents = vi.fn();
const authJson = vi.fn();

const { MockAuthApiError } = vi.hoisted(() => {
  class MockAuthApiError extends Error {
    key: string;
    constructor(key: string) {
      super(key);
      this.key = key;
    }
  }
  return { MockAuthApiError };
});

vi.mock("@/src/ui/auth-api", () => ({
  authJson: (...args: unknown[]) => authJson(...args),
  authNdjsonEvents: (...args: unknown[]) => authNdjsonEvents(...args),
  AuthApiError: MockAuthApiError,
}));

function applyTravorShell() {
  document.body.className = "shell-app";
  document.body.dataset.style = "travor";
}

describe("TC-M10-46-05 plan-page takeoff", () => {
  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/travel-tips") {
        return { ok: true, data: { intro: "Tips" } };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    authNdjsonEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_render_takeoff_and_open_assistant_without_posting_plan", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);

    await waitFor(() => {
      expect(getByTestId("plan-dest")).toBeTruthy();
    });

    expect(getByTestId("plan-start-date")).toBeTruthy();
    expect(getByTestId("plan-days")).toBeTruthy();
    expect(getByTestId("plan-party")).toBeTruthy();
    expect(getByTestId("plan-budget")).toBeTruthy();
    expect((getByTestId("plan-budget") as HTMLSelectElement).value).toBe("mid");
    expect(container.querySelector(".plan-board__stack")).toBeNull();
    expect(container.querySelector(".plan-takeoff")).toBeTruthy();

    fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
    fireEvent.blur(getByTestId("plan-dest"));
    await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());
    fireEvent.change(getByTestId("plan-days"), { target: { value: "4" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });

    fireEvent.click(getByTestId("plan-submit"));
    await waitFor(() => expect(getByTestId("plan-submit-confirm-ok")).toBeTruthy());
    fireEvent.click(getByTestId("plan-submit-confirm-ok"));

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-nav"]')).toBeTruthy();
      expect(getByTestId("plan-constraints")).toBeTruthy();
    });

    expect(authNdjsonEvents).not.toHaveBeenCalled();
    expect(container.querySelector(".plan-takeoff")).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-takeover"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="plan-nav-default"]')).toBeNull();
  });
});

describe("TC-M10-46-08 plan-takeoff horizontal layout", () => {
  beforeEach(() => {
    applyTravorShell();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/travel-tips") return { ok: true, data: { intro: "Tips" } };
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_use_takeoff_eleven_grid_fields", async () => {
    const { container, getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(container.querySelector(".plan-takeoff--11")).toBeTruthy());

    const takeoff = container.querySelector(".plan-takeoff") as HTMLElement;
    expect(getByTestId("plan-takeoff-11")).toBeTruthy();
    expect(takeoff.querySelectorAll("[data-field]").length).toBe(11);
    expect(takeoff.querySelector('[data-field="dest"]')).toBeTruthy();
    expect(takeoff.querySelector('[data-field="origin"]')).toBeTruthy();
    expect(takeoff.querySelector('[data-field="start_time"]')).toBeTruthy();
    expect(takeoff.querySelector('[data-field="other"]')).toBeTruthy();
    expect(takeoff.querySelector('[data-field="must_see"]')).toBeNull();
  });

  it("should_resolve_origin_on_blur_without_destVerified_gate", async () => {
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
    fireEvent.blur(getByTestId("plan-dest"));
    await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());

    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return {
          ok: true,
          kind: "candidates",
          cards: [{ name: "Hills Hotel" }, { name: "Hills Hostel" }],
        };
      }
      return { ok: true };
    });

    fireEvent.change(getByTestId("plan-origin"), { target: { value: "Hills" } });
    fireEvent.blur(getByTestId("plan-origin"));
    await waitFor(() => expect(getByTestId("plan-origin-overlay")).toBeTruthy());
    expect(getByTestId("plan-origin-candidates")).toBeTruthy();
    expect(authJson.mock.calls.some((c) => c[0] === "/api/plan/resolve-origin")).toBe(true);
  });
});

describe("TC-M10-46-09 plan-constraints grid layout", () => {
  beforeEach(() => {
    applyTravorShell();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/travel-tips") return { ok: true, data: { intro: "Tips" } };
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_render_constraint_grid_after_takeoff_submit", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());

    fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
    fireEvent.blur(getByTestId("plan-dest"));
    await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());
    fireEvent.change(getByTestId("plan-days"), { target: { value: "3" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
    fireEvent.click(getByTestId("plan-submit"));
    await waitFor(() => expect(getByTestId("plan-submit-confirm-ok")).toBeTruthy());
    fireEvent.click(getByTestId("plan-submit-confirm-ok"));

    await waitFor(() => expect(getByTestId("plan-constraints")).toBeTruthy());

    const grids = container.querySelectorAll(".constraint-grid");
    expect(grids).toHaveLength(1);
    expect(grids[0]?.querySelectorAll(".constraint-item").length).toBe(11);
    expect(container.querySelector('[data-testid="constraint-must-see"]')).toBeNull();
  });
});

describe("TC-M10-46-10 plan-nav fixed floating panel", () => {
  beforeEach(() => {
    applyTravorShell();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/travel-tips") return { ok: true, data: { intro: "Tips" } };
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_mount_fixed_plan_nav_on_body_after_intake", async () => {
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());

    fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
    fireEvent.blur(getByTestId("plan-dest"));
    await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());
    fireEvent.change(getByTestId("plan-days"), { target: { value: "3" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
    fireEvent.click(getByTestId("plan-submit"));
    await waitFor(() => expect(getByTestId("plan-submit-confirm-ok")).toBeTruthy());
    fireEvent.click(getByTestId("plan-submit-confirm-ok"));

    await waitFor(() => expect(document.body.querySelector(".plan-nav.is-open")).toBeTruthy());

    const nav = document.body.querySelector(".plan-nav.is-open") as HTMLElement;
    expect(nav).toBeTruthy();
    expect(nav.closest(".plan-stack")).toBeNull();
    expect(document.body.contains(nav)).toBe(true);
    expect(nav.querySelector(".plan-nav__panel")).toBeTruthy();
    // T3 mockup 06: terminate stays while framework is generating.
    expect(nav.querySelector('[data-testid="plan-nav-terminate"]')).toBeTruthy();
    expect(nav.querySelector('[data-testid="plan-nav-close"]')).toBeTruthy();
  });
});

describe("TC-M10-46-11 plan-page head actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return {
          ok: true,
          criteria: {
            destination: "Lisbon",
            days: 2,
            startDate: "2026-09-20",
            partySize: 2,
            budget: "$$ Mid-range",
          },
          itinerary: {
            title: "Lisbon",
            destination: "Lisbon",
            daysCount: 2,
            updatedAt: new Date().toISOString(),
            days: [
              {
                dayIndex: 1,
                highlights: { label: "Highlights", title: "Day 1", tags: [] },
                slots: [],
              },
            ],
          },
        };
      }
      if (url === "/api/plan/travel-tips") {
        return { ok: true, data: { intro: "Tips" } };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should_show_panel_head_actions_without_bottom_sticky_bar", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);

    await waitFor(() => expect(getByTestId("plan-itinerary")).toBeTruthy());

    expect(getByTestId("replan-open")).toBeTruthy();
    expect(getByTestId("plan-save")).toBeTruthy();
    expect(getByTestId("plan-export")).toBeTruthy();
    expect(container.querySelector(".plan-actions")).toBeNull();
    expect(container.querySelector(".panel__head-actions")).toBeTruthy();
  });

  it("should_restore_blank_takeoff_when_replan_confirmed", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);

    await waitFor(() => expect(container.querySelector('[data-testid="plan-itinerary"]')).toBeTruthy());
    const replanBtn = container.querySelector(
      '[data-testid="plan-itinerary"] [data-testid="replan-open"]',
    );
    expect(replanBtn).toBeTruthy();
    fireEvent.click(replanBtn!);
    await waitFor(() => expect(getByTestId("replan-confirm")).toBeTruthy());
    fireEvent.click(getByTestId("replan-confirm"));

    await waitFor(() => expect(container.querySelector(".plan-takeoff")).toBeTruthy());
    expect((getByTestId("plan-dest") as HTMLInputElement).value).toBe("");
    expect((getByTestId("plan-budget") as HTMLSelectElement).value).toBe("mid");
    expect(getByTestId("plan-days")).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-itinerary"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-terminate"]')).toBeNull();
    expect(authJson.mock.calls.some((c) => c[0] === "/api/plan/current" && (c[1] as { method?: string })?.method === "DELETE")).toBe(true);
  });
});

describe("Feature 37 AC13 iconic single source", () => {
  const iconic = ["Riverfront", "Old town", "Day-trip area"];

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 2, iconic_places: iconic };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    authNdjsonEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_not_discover_or_show_tips_on_cta", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(container.querySelector('[data-testid="plan-dest"]')).toBeTruthy());

    fireEvent.change(container.querySelector('[data-testid="plan-dest"]')!, { target: { value: "Porto" } });
    fireEvent.blur(container.querySelector('[data-testid="plan-dest"]')!);
    await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());
    fireEvent.change(getByTestId("plan-days"), { target: { value: "4" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
    fireEvent.click(getByTestId("plan-submit"));
    await waitFor(() => expect(getByTestId("plan-submit-confirm-ok")).toBeTruthy());
    fireEvent.click(getByTestId("plan-submit-confirm-ok"));

    await waitFor(() => expect(document.body.querySelector('[data-testid="plan-nav"]')).toBeTruthy());
    expect(container.querySelector('[data-testid="plan-travel-tips"]')).toBeNull();
    expect(container.querySelector('[data-testid="plan-travel-tips"]')).toBeNull();
    expect(authNdjsonEvents).not.toHaveBeenCalled();
  });
});

describe("TC-M20-41 Feature 41 Story 1 CTA intake", () => {
  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/discover") {
        return {
          ok: true,
          trip_id: "t1",
          revision: 1,
          iconic_places: ["Hot Alpha", "Hot Beta"],
          pool: [
            { name: "Hot Alpha", heat: 45000, must_see: true, kind: "place" },
            { name: "Hot Beta", heat: 12000, must_see: true, kind: "place" },
          ],
        };
      }
      if (url === "/api/plan/session") {
        return { ok: true, trip_id: "t1" };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    authNdjsonEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("TC-M20-41-01 should_open_assistant_and_hide_takeoff_without_posting_plan", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);

    expect(container.querySelector(".plan-takeoff")).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav"]')).toBeTruthy();
    expect(authNdjsonEvents).not.toHaveBeenCalled();

    const thread = document.body.querySelector('[data-testid="plan-nav-thread"]')?.textContent ?? "";
    expect(thread).not.toContain("Searching places and food");
    expect(thread).not.toContain("Building the day outline");
    expect(document.body.querySelector('[data-testid="plan-phase"]')).toBeNull();
  });

  it("TC-M20-41-02 should_show_takeoff_values_and_pending_assistant_constraints", async () => {
    // Rewritten for `2play-plan-101` AC1: no fixed four-question pending; constraints from takeoff.
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);

    const panel = container.querySelector('[data-testid="plan-constraints"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain("Lisbon");
    const pending = container.querySelectorAll(".constraint-item__pending");
    expect(pending.length).toBe(0);
    expect(container.querySelector('[data-testid="constraint-must-see"]')).toBeNull();
    expect(panel?.textContent).toContain("09:00");
    // Empty takeoff origin → "no hotel" display (i18n), not a pending assistant hotel step.
    expect(panel?.textContent).toMatch(/None \(no daily transit routing\)|无（不安排每日交通）|無（不安排每日交通）/);
  });

  it("TC-M20-41-04 should_not_show_search_copy_chips_or_tips_on_cta", async () => {
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);

    const thread = document.body.querySelector('[data-testid="plan-nav-thread"]')?.textContent ?? "";
    expect(thread).not.toContain("Searching places and food");
    expect(container.querySelector('[data-testid="plan-travel-tips"]')).toBeNull();
    expect(document.body.querySelectorAll(".plan-nav__quick .chip")).toHaveLength(0);
    expect(authNdjsonEvents).not.toHaveBeenCalled();
  });
});

/** Minimal agent skeleton accepted by hydrateFromAgentSkeleton (T3 / `2play-plan-101`). */
const T3_SKELETON = {
  days: [
    {
      day_index: 1,
      day_theme: "Belém",
      stops: [
        { name: "Hills Hotel", kind: "stay" },
        { name: "Torre de Belém", kind: "place" },
      ],
    },
  ],
};

function mockT3TripSuccess(url: string, init?: RequestInit) {
  if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
  if (url === "/api/geocode") {
    return {
      ok: true,
      country: "Portugal",
      city: "Lisbon",
      lat: 38.72,
      lng: -9.14,
      crs: "WGS84",
    };
  }
  if (url === "/api/plan/resolve-origin") {
    return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
  }
  if (url === "/api/plan/trip" && init?.method === "POST") {
    return {
      ok: true,
      trip_id: "t1",
      revision: 1,
      status: "ready",
      phases: [
        { phase: "trip_created", trip_id: "t1" },
        { phase: "skeleton_generating", trip_id: "t1" },
        { phase: "skeleton_ready", trip_id: "t1", revision: 1 },
      ],
      skeleton: T3_SKELETON,
    };
  }
  return { ok: true };
}

async function submitTakeoff(getByTestId: (id: string) => HTMLElement) {
  fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
  fireEvent.blur(getByTestId("plan-dest"));
  await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());
  fireEvent.change(getByTestId("plan-days"), { target: { value: "2" } });
  fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
  fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
  fireEvent.click(getByTestId("plan-submit"));
  await waitFor(() => expect(getByTestId("plan-submit-confirm-ok")).toBeTruthy());
  fireEvent.click(getByTestId("plan-submit-confirm-ok"));
  await waitFor(() => expect(document.body.querySelector('[data-testid="plan-nav"]')).toBeTruthy());
}

async function sendIntakeDefault(getByTestId: (id: string) => HTMLElement) {
  await waitFor(() => {
    expect((getByTestId("plan-nav-send") as HTMLButtonElement).disabled).toBe(false);
  });
  const n = document.body.querySelectorAll(".bubble--user").length;
  fireEvent.click(getByTestId("plan-nav-send"));
  await waitFor(() => {
    expect(document.body.querySelectorAll(".bubble--user").length).toBe(n + 1);
  });
}

async function completeIntake(getByTestId: (id: string) => HTMLElement) {
  for (let i = 0; i < 7; i += 1) {
    await sendIntakeDefault(getByTestId);
  }
}

describe("TC-M20-41 Feature 41 Story 2 silent init", () => {
  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authNdjsonEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  // Fixed four-question intake + g chips superseded by `2play-plan-101` / ADR-062 (T3 skeleton path).
  // Must-see chips / hotel refill after takeoff are non-goals; expand-radius covered in plan-expand-radius.test.tsx.
  it.skip("TC-M20-41-12 should_hide_g_chips_until_discover_settles — superseded by 2play-plan-101 (no step g after takeoff)", async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/trip") {
        return { ok: true, trip_id: "t1", revision: 1, status: "needs_input", need_input: { questions: [] } };
      }
      if (url === "/api/plan/candidates") {
        await hold;
        return {
          ok: true,
          trip_id: "t1",
          iconic_places: ["Hot Alpha"],
          pool: [{ name: "Hot Alpha", heat: 9, must_see: true, kind: "place" }],
        };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await waitFor(() => {
      expect((getByTestId("plan-nav-send") as HTMLButtonElement).disabled).toBe(false);
      expect(document.body.textContent).toMatch(/hotel|住宿|起点|Hotel/i);
    });
    for (let i = 0; i < 4; i += 1) {
      await sendIntakeDefault(getByTestId);
    }

    await waitFor(() => {
      expect(document.body.textContent).toContain("Loading suggested must-sees");
    });
    expect(document.body.querySelectorAll(".plan-nav__quick .chip")).toHaveLength(0);

    release();
    await waitFor(() => {
      const chips = [...document.body.querySelectorAll(".plan-nav__quick .chip")].map((el) => el.textContent);
      expect(chips).toContain("Hot Alpha");
    });
    expect(authJson.mock.calls.some((c) => c[0] === "/api/plan/candidates")).toBe(true);
  });

  it.skip("TC-M20-41-13 should_refill_constraint_and_patch_session — superseded by 2play-plan-101 (no hotel intake step)", async () => {
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1, iconic_places: [], pool: [] };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-nav-thread"]')?.textContent).toMatch(
        /staying|住宿/,
      );
    });

    const input = getByTestId("plan-nav-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hotel Test" } });
    await sendIntakeDefault(getByTestId);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="plan-constraints"]')?.textContent).toContain("Hotel Test");
    });
    expect(
      authJson.mock.calls.some((c) => c[0] === "/api/plan/session" && (c[1] as { method?: string })?.method === "PATCH"),
    ).toBe(true);
  });

  it.skip("TC-M20-41-14/19 should_start_fill_stream_and_show_skeleton_card_without_preview_title (T2 fill)", async () => {
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1 };
      }
      if (url === "/api/plan/candidates") {
        return {
          ok: true,
          trip_id: "t1",
          iconic_places: ["Hot Alpha"],
          pool: [{ name: "Hot Alpha", heat: 9, must_see: true, kind: "place" }],
        };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        theme: "Belem",
        stops: [
          { name: "Hotel", kind: "stay" },
          { name: "Tower", kind: "place" },
        ],
        itinerary: {
          title: "Lisbon",
          destination: "Lisbon",
          daysCount: 2,
          updatedAt: new Date().toISOString(),
          days: [],
        },
      });
      onEvent({
        type: "skeleton_done",
        itinerary: {
          title: "Lisbon",
          destination: "Lisbon",
          daysCount: 2,
          updatedAt: new Date().toISOString(),
          days: [],
        },
        tripId: "t1",
        revision: 4,
      });
      onEvent({ type: "phase", phase: "filling", dayIndex: 1, daysTotal: 2 });
      onEvent({
        type: "stop_filled",
        dayIndex: 1,
        slot: {
          kind: "place",
          start: "10:00",
          end: "11:00",
          placeKind: "attraction",
          name: "Tower",
          summary: "",
        },
        itinerary: {
          title: "Lisbon",
          destination: "Lisbon",
          daysCount: 2,
          updatedAt: new Date().toISOString(),
          days: [],
        },
      });
      onEvent({
        type: "done",
        itinerary: {
          title: "Lisbon",
          destination: "Lisbon",
          daysCount: 2,
          updatedAt: new Date().toISOString(),
          days: [],
        },
      });
    });
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await waitFor(() =>
      expect(authJson.mock.calls.some((c) => c[0] === "/api/plan/trip")).toBe(true),
    );
    for (let i = 0; i < 5; i += 1) {
      await sendIntakeDefault(getByTestId);
    }
    await sendIntakeDefault(getByTestId);
    await sendIntakeDefault(getByTestId);

    await waitFor(() => expect(authNdjsonEvents).toHaveBeenCalled());
    const planCall = authNdjsonEvents.mock.calls.find((c) => c[0] === "/api/plan");
    expect(planCall).toBeTruthy();
    const body = JSON.parse(String((planCall?.[1] as { body?: string })?.body ?? "{}"));
    expect(body.mode).not.toBe("skeleton");
    expect(document.body.querySelector('[data-testid="plan-nav-debug-dump"]')).toBeNull();

    await waitFor(() => {
      const thread = document.body.querySelector('[data-testid="plan-nav-thread"]')?.textContent ?? "";
      // After done: only complete prose; skeleton spine remains when fill spine empty.
      expect(thread).toContain("Your itinerary is ready.");
      expect(thread).not.toContain("I understand your request and am drafting the itinerary outline");
      expect(document.body.querySelector('[data-testid="plan-thread-skeleton"]')?.textContent).toContain(
        "Tower",
      );
    });
    const skel = document.body.querySelector('[data-testid="plan-thread-skeleton"]')?.textContent ?? "";
    expect(skel).not.toContain("Skeleton preview");
  });

  it.skip("TC-M20-41-18 should_show_elapsed_then_friendly_error_when_make_fails (T2 fill)", async () => {
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") return { ok: true, trip_id: "t1", revision: 1 };
      if (url === "/api/plan/candidates") {
        return { ok: true, trip_id: "t1", iconic_places: ["Hot Alpha"], pool: [] };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      await new Promise((r) => setTimeout(r, 120));
      onEvent({ type: "error", key: "play.plan.phase_make_timeout" });
    });
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    for (let i = 0; i < 5; i += 1) {
      await sendIntakeDefault(getByTestId);
    }
    await waitFor(() => {
      expect((getByTestId("plan-nav-send") as HTMLButtonElement).disabled).toBe(false);
    });
    await sendIntakeDefault(getByTestId);
    await sendIntakeDefault(getByTestId);

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-make-progress"]')).toBeTruthy();
      expect(document.body.querySelector('[data-testid="plan-make-elapsed"]')).toBeTruthy();
    });
    await waitFor(() => {
      const thread = document.body.querySelector('[data-testid="plan-nav-thread"]')?.textContent ?? "";
      expect(thread).toContain("The outline is taking too long");
    });
    expect(document.body.querySelector('[data-testid="plan-thread-skeleton"]')).toBeNull();
  });
});

describe.skip("TC-M19-40-03 / TC-M23-S1 assistant narrative thread order (fill) — T2", () => {
  const shellItinerary = {
    title: "Lisbon",
    destination: "Lisbon",
    daysCount: 2,
    updatedAt: new Date().toISOString(),
    days: [] as { dayIndex: number; highlights: { label: string; title: string; tags: string[] }; slots: unknown[] }[],
  };

  const staySlot = {
    kind: "place" as const,
    start: "09:00",
    end: "09:30",
    placeKind: "stay",
    name: "Hotel Lisboa",
    summary: "",
  };

  const towerSlot = {
    kind: "place" as const,
    start: "10:00",
    end: "12:00",
    placeKind: "attraction",
    name: "Belém Tower",
    summary: "Iconic tower",
  };

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1, iconic_places: [] };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_show_day_heading_skeleton_ready_then_fill_before_plan_complete", async () => {
    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        theme: "Belém",
        itinerary: shellItinerary,
        stops: [
          { name: "Hotel Lisboa", kind: "stay" },
          { name: "Belém Tower", kind: "attraction" },
        ],
      });
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "phase", phase: "filling", dayIndex: 1, daysTotal: 2 });
      onEvent({ type: "stop_filled", dayIndex: 1, itinerary: shellItinerary, slot: staySlot });
      onEvent({ type: "stop_filled", dayIndex: 1, itinerary: shellItinerary, slot: towerSlot });
      onEvent({ type: "done", itinerary: { ...shellItinerary, days: [{ dayIndex: 1, highlights: { label: "Highlights", title: "Day 1", tags: [] }, slots: [staySlot, towerSlot] }] } });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => expect(authNdjsonEvents).toHaveBeenCalled());

    await waitFor(() => {
      const fillTimeline =
        document.body.querySelector('[data-testid="plan-thread-fill-timeline"]')?.textContent ?? "";
      expect(fillTimeline).toContain("Belém Tower");
    });

    const thread = document.body.querySelector('[data-testid="plan-nav-thread"]') as HTMLElement;
    expect(thread).toBeTruthy();
    const text = thread.textContent ?? "";
    // After done: prose is only the complete line; fill spine remains (24-P0-ui-C-fix).
    expect(text).toContain("Your itinerary is ready.");
    expect(text).not.toContain("I understand your request and am drafting the itinerary outline");
    expect(document.body.querySelector('[data-testid="plan-thread-skeleton"]')).toBeNull();

    const fillEl = document.body.querySelector('[data-testid="plan-thread-fill-timeline"]');
    const completeEl = document.body.querySelector('[data-testid="plan-thread-complete"]');
    expect(fillEl).toBeTruthy();
    expect(completeEl).toBeTruthy();
    expect(completeEl!.textContent).toContain("Your itinerary is ready.");
    // Complete line must follow fill spine (tmp-ui bug #4).
    const position = fillEl!.compareDocumentPosition(completeEl!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should_disable_send_while_must_see_candidates_load", async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/trip") {
        return {
          ok: true,
          trip_id: "t1",
          revision: 1,
          status: "needs_input",
          need_input: { questions: [] },
        };
      }
      if (url === "/api/plan/candidates") {
        await hold;
        return {
          ok: true,
          trip_id: "t1",
          iconic_places: ["Hot Alpha"],
          pool: [{ name: "Hot Alpha", heat: 9, must_see: true, kind: "place" }],
        };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    for (let i = 0; i < 5; i += 1) {
      await sendIntakeDefault(getByTestId);
    }

    await waitFor(() => {
      const send = getByTestId("plan-nav-send") as HTMLButtonElement;
      const input = getByTestId("plan-nav-input") as HTMLInputElement;
      expect(send.disabled).toBe(true);
      expect(input.disabled).toBe(false);
      expect(send.className).toContain("is-send-locked");
    });

    release();
    await waitFor(() => {
      const send = getByTestId("plan-nav-send") as HTMLButtonElement;
      expect(send.disabled).toBe(false);
    });
  });

  it("should_disable_send_while_fill_stream_open_then_enable_after_done", async () => {
    let releaseDone: () => void = () => undefined;
    const holdDone = new Promise<void>((resolve) => {
      releaseDone = resolve;
    });

    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        theme: "Belém",
        itinerary: shellItinerary,
        stops: [{ name: "Belém Tower", kind: "attraction" }],
      });
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "phase", phase: "filling", dayIndex: 1, daysTotal: 1 });
      await holdDone;
      onEvent({ type: "done", itinerary: shellItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      const send = getByTestId("plan-nav-send") as HTMLButtonElement;
      expect(send.disabled).toBe(true);
    });

    releaseDone();
    await waitFor(() => {
      const send = getByTestId("plan-nav-send") as HTMLButtonElement;
      expect(send.disabled).toBe(false);
    });
  });

  it("should_show_phase_making_during_skeleton_subphase", async () => {
    let releaseFill: () => void = () => undefined;
    const holdFill = new Promise<void>((resolve) => {
      releaseFill = resolve;
    });

    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        theme: "Belém",
        itinerary: shellItinerary,
        stops: [
          { name: "Hotel Lisboa", kind: "stay" },
          { name: "Belém Tower", kind: "attraction" },
        ],
      });
      await holdFill;
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "done", itinerary: shellItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      const phase = document.body.querySelector('[data-testid="plan-phase"]');
      expect(phase?.textContent).toContain("Building the day outline");
    });

    releaseFill();
    await waitFor(() => expect(document.body.querySelector('[data-testid="plan-itinerary"]')).toBeTruthy());
  });
});

describe.skip("TC-M19-40-04 / TC-M23-S1 filling main list skeleton stops — T2", () => {
  const shellItinerary = {
    title: "Lisbon",
    destination: "Lisbon",
    daysCount: 1,
    updatedAt: new Date().toISOString(),
    days: [] as { dayIndex: number; highlights: { label: string; title: string; tags: string[] }; slots: unknown[] }[],
  };

  const staySlot = {
    kind: "place" as const,
    start: "09:00",
    end: "09:30",
    placeKind: "stay",
    name: "Hotel Lisboa",
    summary: "",
  };

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1, iconic_places: [] };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_show_stay_slot_and_pending_non_stay_skeleton_stop_during_fill", async () => {
    let releaseDone: () => void = () => undefined;
    const holdDone = new Promise<void>((resolve) => {
      releaseDone = resolve;
    });

    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        itinerary: shellItinerary,
        stops: [
          { name: "Hotel Lisboa", kind: "stay" },
          { name: "Belém Tower", kind: "attraction" },
        ],
      });
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "phase", phase: "filling", dayIndex: 1, daysTotal: 1 });
      onEvent({ type: "stop_filled", dayIndex: 1, itinerary: shellItinerary, slot: staySlot });
      await holdDone;
      onEvent({ type: "done", itinerary: shellItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      expect(getByTestId("stop-origin")).toBeTruthy();
      const skeletonNames = [...document.querySelectorAll('[data-testid="plan-skeleton-stop"]')].map(
        (el) => el.querySelector(".skeleton-stop__name")?.textContent?.trim(),
      );
      expect(skeletonNames).toContain("Belém Tower");
    });

    releaseDone();
  });
});

describe.skip("24-P0-ui-C itinerary detail (AC39–41) — T2 fill", () => {
  const shellItinerary = {
    title: "Lisbon",
    destination: "Lisbon",
    daysCount: 1,
    updatedAt: new Date().toISOString(),
    days: [] as {
      dayIndex: number;
      highlights: { label: string; title: string; tags: string[] };
      slots: unknown[];
    }[],
  };

  const staySlot = {
    kind: "place" as const,
    start: "09:00",
    end: "09:30",
    placeKind: "stay",
    name: "Hotel Lisboa",
    summary: "",
    provider: "google",
    nativeId: "stay-1",
    mapUrl: "https://maps.example/stay",
  };

  const towerSlot = {
    kind: "place" as const,
    start: "10:00",
    end: "12:00",
    placeKind: "attraction",
    name: "Belém Tower",
    summary: "Iconic tower",
    provider: "google",
    nativeId: "tower-1",
    mapUrl: "https://maps.example/tower",
    // ADR-051: thumbs come from agent-resolved photos, not details backfill.
    photoUrl: "https://cdn.example/tower.jpg",
  };

  const filledItinerary = {
    ...shellItinerary,
    days: [
      {
        dayIndex: 1,
        highlights: { label: "Highlights", title: "Day 1", tags: [] },
        slots: [staySlot, towerSlot],
      },
    ],
  };

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1, iconic_places: [] };
      }
      if (url.startsWith("/api/places/")) {
        return {
          ok: true,
          data: {
            name: "Belém Tower",
            photos: ["https://cdn.example/tower.jpg"],
          },
        };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_clear_day_skeleton_and_slot_preview_after_done (TC-M24-UIC-02)", async () => {
    let releaseDone: () => void = () => undefined;
    const holdDone = new Promise<void>((resolve) => {
      releaseDone = resolve;
    });

    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        theme: "Belém",
        itinerary: shellItinerary,
        stops: [
          { name: "Hotel Lisboa", kind: "stay" },
          { name: "Belém Tower", kind: "attraction" },
        ],
      });
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "phase", phase: "filling", dayIndex: 1, daysTotal: 1 });
      onEvent({
        type: "slot_preview",
        dayIndex: 1,
        kind: "attraction",
        name: "Belém Tower",
      });
      await holdDone;
      onEvent({ type: "stop_filled", dayIndex: 1, itinerary: shellItinerary, slot: staySlot });
      onEvent({ type: "done", itinerary: filledItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-skeleton-day"]')).toBeTruthy();
      expect(document.body.querySelector('[data-testid="plan-slot-preview"]')).toBeTruthy();
    });

    releaseDone();

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-skeleton-day"]')).toBeNull();
      expect(document.body.querySelector('[data-testid="plan-slot-preview"]')).toBeNull();
      expect(document.body.querySelector('[data-testid="stop-filled"]')).toBeTruthy();
    });
  });

  it("should_open_place_sheet_from_thumb_with_agent_photo (TC-M24-UIC-03 ADR-051)", async () => {
    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "filling", dayIndex: 1, daysTotal: 1 });
      onEvent({ type: "done", itinerary: filledItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      const img = document.body.querySelector(
        '[data-testid="stop-filled"] img.slot-thumb',
      ) as HTMLImageElement | null;
      expect(img?.src).toContain("cdn.example/tower.jpg");
    });

    const thumbs = document.body.querySelectorAll('[data-testid="stop-thumb-open"]');
    const towerThumb = [...thumbs].find((el) =>
      el.closest('[data-testid="stop-filled"]')?.textContent?.includes("Belém Tower"),
    );
    expect(towerThumb).toBeTruthy();
    fireEvent.click(towerThumb!);

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="place-sheet"]')).toBeTruthy();
      expect(document.body.querySelector(".place-dialog__bar")).toBeTruthy();
      expect(document.body.querySelector(".place-split__media")).toBeTruthy();
      expect(document.body.querySelector(".place-panel--itin")).toBeTruthy();
      expect(document.body.querySelector(".place-panel--nav")).toBeTruthy();
    });

    expect(authJson).toHaveBeenCalledWith(
      expect.stringContaining("/api/places/google/tower-1"),
    );
  });

  it("should_use_1x1_slot_thumb_dimensions (TC-M24-UIC-04)", async () => {
    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({
        type: "done",
        itinerary: {
          ...filledItinerary,
          days: [
            {
              ...filledItinerary.days[0]!,
              slots: [{ ...towerSlot, photoUrl: "https://cdn.example/existing.jpg" }],
            },
          ],
        },
      });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      expect(document.body.querySelector("img.slot-thumb")).toBeTruthy();
    });

    const thumb = document.body.querySelector("img.slot-thumb") as HTMLElement;
    expect(thumb.classList.contains("slot-thumb")).toBe(true);
    expect(thumb.tagName).toBe("IMG");
  });
});

describe("24-P0-ui-C slot-thumb CSS contract (TC-M24-UIC-04b)", () => {
  it("should_define_equal_square_thumb_in_mockup_css", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(__dirname, "../app/mockup.css"), "utf8");
    const block = css.match(/\.slot-thumb\s*\{[^}]+\}/);
    expect(block?.[0]).toMatch(/width:\s*5\.5rem/);
    expect(block?.[0]).toMatch(/height:\s*5\.5rem/);
    expect(block?.[0]).toMatch(/aspect-ratio:\s*1\s*\/\s*1/);
  });
});

describe.skip("transit slot structured pills (ADR-052 update) — T2 fill", () => {
  const shellItinerary = {
    title: "Lisbon",
    destination: "Lisbon",
    daysCount: 1,
    updatedAt: new Date().toISOString(),
    days: [] as {
      dayIndex: number;
      highlights: { label: string; title: string; tags: string[] };
      slots: unknown[];
    }[],
  };

  const staySlot = {
    kind: "place" as const,
    start: "09:00",
    end: "09:30",
    placeKind: "stay",
    name: "Hills Hotel",
    summary: "",
  };

  const transitSlot = {
    kind: "transit" as const,
    start: "",
    text: "legacy text",
    from: "Hills Hotel",
    to: "Belém Tower",
    legs: [
      { mode: "transit", duration_min: 35, recommended: true },
      { mode: "drive", duration_min: 15 },
    ],
    outcome: "directions",
  };

  const towerSlot = {
    kind: "place" as const,
    start: "10:00",
    end: "12:00",
    placeKind: "attraction",
    name: "Belém Tower",
    summary: "Iconic tower",
  };

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1, iconic_places: [] };
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_render_structured_transit_pills_with_from_to_and_legs", async () => {
    const filledItinerary = {
      ...shellItinerary,
      days: [
        {
          dayIndex: 1,
          highlights: { label: "Highlights", title: "Day 1", tags: [] },
          slots: [staySlot, transitSlot, towerSlot],
        },
      ],
    };

    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        itinerary: shellItinerary,
        stops: [
          { name: "Hills Hotel", kind: "stay" },
          { name: "Belém Tower", kind: "attraction" },
        ],
      });
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "done", itinerary: filledItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      const transitEl = document.body.querySelector('[data-testid="plan-transit-slot"]');
      expect(transitEl).toBeTruthy();
      // Structured from/to rendered
      const fromEl = transitEl!.querySelector(".transit-from .transit-place");
      const toEl = transitEl!.querySelector(".transit-to .transit-place");
      expect(fromEl?.textContent).toContain("Hills Hotel");
      expect(toEl?.textContent).toContain("Belém Tower");
      // Structured legs rendered as pills
      const options = transitEl!.querySelectorAll(".transit-option");
      expect(options.length).toBe(2);
      // Recommended leg flagged
      expect(options[0]!.classList.contains("transit-option--rec")).toBe(true);
      // Mode label resolved through i18n (default locale EN)
      expect(options[0]!.textContent?.toLowerCase()).toContain("transit");
      expect(options[0]!.textContent).toContain("35");
      expect(options[1]!.textContent?.toLowerCase()).toContain("drive");
      expect(options[1]!.textContent).toContain("15");
    });
  });

  it("should_fallback_to_text_when_no_structured_legs", async () => {
    const legacyTransitSlot = {
      kind: "transit" as const,
      start: "",
      text: "Walk 10 min",
    };
    const filledItinerary = {
      ...shellItinerary,
      days: [
        {
          dayIndex: 1,
          highlights: { label: "Highlights", title: "Day 1", tags: [] },
          slots: [staySlot, legacyTransitSlot, towerSlot],
        },
      ],
    };

    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({ type: "phase", phase: "skeleton" });
      onEvent({
        type: "skeleton_day",
        dayIndex: 1,
        itinerary: shellItinerary,
        stops: [
          { name: "Hills Hotel", kind: "stay" },
          { name: "Belém Tower", kind: "attraction" },
        ],
      });
      onEvent({ type: "skeleton_done", itinerary: shellItinerary });
      onEvent({ type: "done", itinerary: filledItinerary });
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await completeIntake(getByTestId);

    await waitFor(() => {
      const transitEl = document.body.querySelector('[data-testid="plan-transit-slot"]');
      expect(transitEl).toBeTruthy();
      // Legacy text fallback rendered in slot-body
      const bodyEl = transitEl!.querySelector(".slot-body");
      expect(bodyEl?.textContent).toContain("Walk 10 min");
      // No structured pills
      expect(transitEl!.querySelectorAll(".transit-option").length).toBe(0);
    });
  });
});

describe("intake hotel step session errors", () => {
  const assign = vi.fn();

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });
    authJson.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      // T3 (`2play-plan-101`): auth failure surfaces on POST /api/plan/trip, not hotel PATCH.
      if (url === "/api/plan/trip" && init?.method === "POST") {
        throw new MockAuthApiError("errors.session_expired");
      }
      if (url === "/api/geocode") {
        return {
          ok: true,
          country: "Portugal",
          city: "Lisbon",
          lat: 38.72,
          lng: -9.14,
          crs: "WGS84",
        };
      }
      if (url === "/api/plan/resolve-origin") {
        return { ok: true, kind: "hit", name: "Hills Hotel", lat: 38.73, lng: -9.14 };
      }
      return { ok: true };
    });
    authNdjsonEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_show_session_expired_and_redirect_when_hotel_patch_returns_401", async () => {
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);

    await waitFor(() => {
      const err = getByTestId("plan-error");
      expect(err.getAttribute("hidden")).toBeNull();
      expect(err.textContent).toMatch(/session expired|登录已过期|登入已過期/i);
    });
    expect(assign).toHaveBeenCalledWith("/login");
  });
});

const AGENT_FOUR_NEEDS = {
  questions: [
    { id: "hotel", prompt: "Hotel?" },
    { id: "start_time", prompt: "Start?" },
    { id: "must_see", prompt: "Must-see?", multi: true },
    { id: "other", prompt: "Other?" },
  ],
};

// Fixed four-need intake after takeoff superseded by `2play-plan-101` / ADR-062.
// Hotel / must-see chip / PATCH session flows remain in component code for expand_radius only;
// keep bodies skipped so regressions can be revived if a post-T3 hotel need returns.
describe("2play-plan-90a T1 session intake without auto-fill", () => {
  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authNdjsonEvents.mockResolvedValue(undefined);
    authJson.mockImplementation(async (url: string, init?: RequestInit) => mockT3TripSuccess(url, init));
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_not_call_plan_ndjson_after_four_need_answers", async () => {
    // Rewritten for T3: takeoff → skeleton_only trip; no NDJSON /api/plan fill stream.
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await waitFor(() => expect(authJson.mock.calls.some((c) => c[0] === "/api/plan/trip")).toBe(true));

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-progress"]')).toBeTruthy();
      expect(document.body.querySelector('[data-testid="plan-thread-skeleton"]')).toBeTruthy();
      expect(document.body.querySelector('[data-testid="plan-nav-takeover"]')).toBeTruthy();
      expect(document.body.querySelector('[data-testid="plan-nav-greeting"]')).toBeNull();
      expect(document.body.querySelector('[data-step="trip_created"]')).toBeNull();
      expect(document.body.querySelector('[data-step="skeleton_generating"]')).toBeTruthy();
    });

    const tripPost = authJson.mock.calls.find(
      (c) => c[0] === "/api/plan/trip" && (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(tripPost).toBeTruthy();
    const body = JSON.parse(String((tripPost?.[1] as { body?: string })?.body ?? "{}"));
    expect(body.skeleton_only).toBe(true);
    expect(authNdjsonEvents).not.toHaveBeenCalled();
    expect(authJson.mock.calls.some((c) => c[0] === "/api/plan")).toBe(false);
  });

  it.skip("should_patch_session_skip_when_hotel_is_empty — superseded by 2play-plan-101 (no hotel need after takeoff)", async () => {
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    await waitFor(() => expect((getByTestId("plan-nav-send") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(getByTestId("plan-nav-send"));

    await waitFor(() => {
      const patch = authJson.mock.calls.find(
        (c) => c[0] === "/api/plan/session" && (c[1] as { method?: string })?.method === "PATCH",
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse(String((patch?.[1] as { body?: string })?.body ?? "{}"));
      expect(body.step).toBe("b");
      expect(body.value).toBe("");
    });
  });

  it.skip("should_update_constraints_bar_when_agent_needs_answered — superseded by 2play-plan-101", async () => {
    expect(AGENT_FOUR_NEEDS.questions.length).toBe(4);
  });

  it.skip("should_stay_on_hotel_need_when_verify_returns_422 — superseded by 2play-plan-101", async () => {
    expect(AGENT_FOUR_NEEDS.questions[0]?.id).toBe("hotel");
  });

  it.skip("should_stack_must_see_chips_and_pin_skip_redo_above_composer — superseded by 2play-plan-101", async () => {
    expect(true).toBe(true);
  });

  it.skip("should_show_hotel_candidates_in_thread_not_dock — superseded by 2play-plan-101", async () => {
    expect(true).toBe(true);
  });
});
