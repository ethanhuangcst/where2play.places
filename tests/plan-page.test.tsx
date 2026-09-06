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

  it("TC-M20-41-14/19 should_start_fill_stream_and_show_skeleton_card_without_preview_title", async () => {
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

describe("TC-M19-40-03 / TC-M23-S1 assistant narrative thread order (fill)", () => {
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
      if (url === "/api/plan/discover") {
        return { ok: true, trip_id: "t1", revision: 1 };
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

describe("TC-M19-40-04 / TC-M23-S1 filling main list skeleton stops", () => {
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

describe("24-P0-ui-C itinerary detail (AC39–41)", () => {
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

describe("intake hotel step session errors", () => {
  const assign = vi.fn();

  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });
    authJson.mockImplementation(async (url: string) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
      }
      if (url === "/api/plan/session") {
        throw new MockAuthApiError("errors.session_expired");
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

    fireEvent.change(getByTestId("plan-nav-input"), {
      target: { value: "Hills Hotel Lisboa" },
    });
    fireEvent.click(getByTestId("plan-nav-send"));

    await waitFor(() => {
      const err = getByTestId("plan-error");
      expect(err.getAttribute("hidden")).toBeNull();
      expect(err.textContent).toMatch(/session expired|登录已过期|登入已過期/i);
    });
    expect(assign).toHaveBeenCalledWith("/login");
    expect(document.body.querySelectorAll(".bubble--user").length).toBe(0);
  });
});

