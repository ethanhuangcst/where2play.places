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
    fireEvent.change(getByTestId("plan-days"), { target: { value: "4" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });

    fireEvent.click(getByTestId("plan-submit"));

    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="plan-nav"]')).toBeTruthy();
      expect(getByTestId("plan-constraints")).toBeTruthy();
    });

    expect(authNdjsonEvents).not.toHaveBeenCalled();
    expect(container.querySelector(".plan-takeoff")).toBeNull();
    expect(document.body.querySelector('[data-testid="plan-nav-terminate"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="plan-nav-default"]')).toBeNull();
  });
});

describe("TC-M10-46-08 plan-takeoff horizontal layout", () => {
  beforeEach(() => {
    applyTravorShell();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/travel-tips") return { ok: true, data: { intro: "Tips" } };
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_use_flex_row_takeoff_with_five_fields", async () => {
    const { container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(container.querySelector(".plan-takeoff")).toBeTruthy());

    const takeoff = container.querySelector(".plan-takeoff") as HTMLElement;
    expect(takeoff.querySelectorAll("[data-field]").length).toBe(5);
    expect(takeoff.querySelector('[data-field="dest"]')).toBeTruthy();
    expect(takeoff.querySelector('[data-field="budget"]')).toBeTruthy();
    expect(takeoff.querySelector(".plan-takeoff__actions")).toBeTruthy();
  });
});

describe("TC-M10-46-09 plan-constraints grid layout", () => {
  beforeEach(() => {
    applyTravorShell();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/travel-tips") return { ok: true, data: { intro: "Tips" } };
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
    fireEvent.change(getByTestId("plan-days"), { target: { value: "3" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
    fireEvent.click(getByTestId("plan-submit"));

    await waitFor(() => expect(getByTestId("plan-constraints")).toBeTruthy());

    const grid = container.querySelector(".constraint-grid") as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.querySelectorAll(".constraint-item").length).toBe(12);
  });
});

describe("TC-M10-46-10 plan-nav fixed floating panel", () => {
  beforeEach(() => {
    applyTravorShell();
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/travel-tips") return { ok: true, data: { intro: "Tips" } };
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
    fireEvent.change(getByTestId("plan-days"), { target: { value: "3" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
    fireEvent.click(getByTestId("plan-submit"));

    await waitFor(() => expect(document.body.querySelector(".plan-nav.is-open")).toBeTruthy());

    const nav = document.body.querySelector(".plan-nav.is-open") as HTMLElement;
    expect(nav).toBeTruthy();
    expect(nav.closest(".plan-stack")).toBeNull();
    expect(document.body.contains(nav)).toBe(true);
    expect(nav.querySelector(".plan-nav__panel")).toBeTruthy();
    expect(nav.querySelector('[data-testid="plan-nav-terminate"]')).toBeTruthy();
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
    fireEvent.change(getByTestId("plan-days"), { target: { value: "4" } });
    fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
    fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
    fireEvent.click(getByTestId("plan-submit"));

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
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);

    const panel = container.querySelector('[data-testid="plan-constraints"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain("Lisbon");
    const pending = container.querySelectorAll(".constraint-item__pending");
    expect(pending.length).toBe(7);
    const mustSee = container.querySelector('[data-testid="constraint-must-see"]');
    expect(mustSee?.textContent).toBe("—");
    expect(mustSee?.textContent).not.toContain("Tower");
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

async function submitTakeoff(getByTestId: (id: string) => HTMLElement) {
  fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
  fireEvent.change(getByTestId("plan-days"), { target: { value: "2" } });
  fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
  fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
  fireEvent.click(getByTestId("plan-submit"));
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

  it("TC-M20-41-12 should_hide_g_chips_until_discover_settles", async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") {
        await hold;
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
      return { ok: true };
    });

    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);
    for (let i = 0; i < 5; i += 1) {
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

  it("TC-M20-41-13 should_refill_constraint_and_patch_session", async () => {
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1, iconic_places: [], pool: [] };
      }
      return { ok: true };
    });
    const { getByTestId, container } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await submitTakeoff(getByTestId);

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

  it("TC-M20-41-14/19 should_start_make_only_and_show_fetch_skeleton_card", async () => {
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
      expect(authJson.mock.calls.some((c) => c[0] === "/api/plan/discover")).toBe(true),
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
    expect(body.mode).toBe("skeleton");
    expect(document.body.querySelector('[data-testid="plan-nav-debug-dump"]')).toBeNull();

    await waitFor(() => {
      const thread = document.body.querySelector('[data-testid="plan-nav-thread"]')?.textContent ?? "";
      expect(thread).not.toContain("I have enough to draft your day outline.");
      expect(thread).toContain("I understand your request and am drafting the itinerary outline");
      expect(thread).toContain("Here is a 2-day outline for Lisbon");
      expect(document.body.querySelector('[data-testid="plan-thread-skeleton"]')?.textContent).toContain(
        "Tower",
      );
    });
    expect(document.body.querySelector('[data-testid="plan-thread-skeleton"]')?.textContent).not.toContain(
      "Arranging",
    );
  });

  it("TC-M20-41-18 should_show_elapsed_then_friendly_error_when_make_fails", async () => {
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") return { ok: true, criteria: null, itinerary: null };
      if (url === "/api/plan/discover") return { ok: true, trip_id: "t1", revision: 1 };
      if (url === "/api/plan/candidates") {
        return { ok: true, trip_id: "t1", iconic_places: ["Hot Alpha"], pool: [] };
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

describe.skip("TC-M19-40-03 assistant narrative thread order (Feature 41 Story 4)", () => {
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
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    document.body.className = "";
    delete document.body.dataset.style;
  });

  it("should_show_know_enough_skeleton_ready_then_fill_before_plan_complete", async () => {
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

    const thread = document.body.querySelector('[data-testid="plan-nav-thread"]') as HTMLElement;
    expect(thread).toBeTruthy();
    const text = thread.textContent ?? "";
    expect(text).toContain("I have enough to draft your day outline.");
    expect(text).toContain("Building the day outline");
    expect(text).toContain("Belém Tower");
    expect(text).toContain("The outline is ready. Filling stop details next.");
    expect(text).not.toContain("Got it — I'll build your itinerary.");

    const skeletonReadyIdx = text.indexOf("The outline is ready");
    const fillIdx = text.indexOf("Arranging Belém Tower");
    expect(skeletonReadyIdx).toBeGreaterThan(-1);
    expect(fillIdx).toBeGreaterThan(skeletonReadyIdx);
    expect(text).toContain("Your itinerary is ready.");
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

describe.skip("TC-M19-40-04 filling main list skeleton stops (Feature 41 Story 4)", () => {
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

