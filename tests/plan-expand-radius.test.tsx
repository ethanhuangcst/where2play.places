/**
 * @vitest-environment jsdom
 * MVP-T3++Q — 2play-plan-104 (TC-T3-104-01 / TC-T3-104-02)
 */
import "@testing-library/jest-dom/vitest";
import "../app/mockup.css";
import "../app/mockup-travor.css";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithLocale } from "./render-with-locale";
import { PlanAssistantNav } from "@/src/ui/plan-assistant-nav";
import PlanPageClient from "@/src/ui/plan-page";
import type { IntakeAnswers, TakeoffFields } from "@/src/core/plan-intake";

function applyTravorShell() {
  document.body.className = "shell-app";
  document.body.dataset.style = "travor";
}

const takeoff: TakeoffFields = {
  destination: "Lisbon",
  startDate: "2026-10-10",
  days: 3,
  partySize: 2,
  budget: "mid",
  tripType: "couple_romance",
  pace: "medium",
  transit: "transit_walk",
};

const answers: IntakeAnswers = {
  b: "Hills Hotel",
  c: "09:00",
};

const expandNeed = {
  id: "expand_radius",
  prompt: "AGENT PROSE MUST NOT SHOW",
  multi: false,
  options: [
    { id: "yes", label: "Yes, expand" },
    { id: "no", label: "No, keep local only" },
  ],
};

describe("plan-assistant expand-radius (TC-T3-104-01)", () => {
  afterEach(() => {
    cleanup();
  });

  it("should_show_confirm_decline_chips_with_i18n_not_agent_prose (TC-T3-104-01)", () => {
    applyTravorShell();
    const onAgentNeedAnswer = vi.fn();
    const { getByTestId, queryByText } = renderWithLocale(
      <PlanAssistantNav
        open
        takeoff={takeoff}
        currentStep={null}
        answers={answers}
        intakeComplete
        skeletonDays={[]}
        statusLines={[]}
        onOpen={() => undefined}
        onClose={() => undefined}
        onAnswer={() => undefined}
        onTerminate={() => undefined}
        onComplete={() => undefined}
        t3Mode
        t3ProgressSteps={[
          { id: "skeleton_generating", state: "current" },
          { id: "skeleton_ready", state: "pending" },
        ]}
        agentNeedQuestions={[expandNeed]}
        agentNeedIndex={0}
        agentNeedAnswers={{}}
        onAgentNeedAnswer={onAgentNeedAnswer}
      />,
    );

    expect(getByTestId("plan-nav-need-prompt").textContent).toMatch(/expand|扩大|擴大/i);
    expect(queryByText("AGENT PROSE MUST NOT SHOW")).toBeNull();
    expect(getByTestId("plan-need-chip-yes")).toBeTruthy();
    expect(getByTestId("plan-need-chip-no")).toBeTruthy();
    expect(getByTestId("plan-need-chip-yes").textContent).not.toBe("Yes, expand");
    fireEvent.click(getByTestId("plan-need-chip-yes"));
    expect(onAgentNeedAnswer).toHaveBeenCalledWith("expand_radius", "yes");
  });
});

const authJson = vi.fn();
const authNdjsonEvents = vi.fn();

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/src/ui/auth-api", () => ({
  authJson: (...args: unknown[]) => authJson(...args),
  authNdjsonEvents: (...args: unknown[]) => authNdjsonEvents(...args),
  AuthApiError: MockAuthApiError,
}));

const skeleton = {
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

async function fillAndSubmit(getByTestId: (id: string) => HTMLElement) {
  fireEvent.change(getByTestId("plan-dest"), { target: { value: "Lisbon" } });
  fireEvent.blur(getByTestId("plan-dest"));
  await waitFor(() => expect(getByTestId("plan-dest-verified")).toBeTruthy());
  fireEvent.change(getByTestId("plan-days"), { target: { value: "3" } });
  fireEvent.change(getByTestId("plan-party"), { target: { value: "2" } });
  fireEvent.change(getByTestId("plan-budget"), { target: { value: "mid" } });
  const origin = getByTestId("plan-origin") as HTMLInputElement;
  fireEvent.change(origin, { target: { value: "Hills Hotel" } });
  fireEvent.blur(origin);
  await waitFor(() => {
    expect((getByTestId("plan-submit") as HTMLButtonElement).disabled).toBe(false);
  });
  fireEvent.click(getByTestId("plan-submit"));
  await waitFor(() => expect(getByTestId("plan-submit-confirm-overlay")).toBeTruthy());
  fireEvent.click(getByTestId("plan-submit-confirm-ok"));
}

describe("plan-page expand-radius continue (TC-T3-104-02)", () => {
  beforeEach(() => {
    applyTravorShell();
    vi.clearAllMocks();
    authNdjsonEvents.mockImplementation(async (_url, _init, onEvent) => {
      onEvent({
        type: "done",
        itinerary: {
          title: "Lisbon",
          destination: "Lisbon",
          daysCount: 1,
          updatedAt: new Date().toISOString(),
          days: [],
        },
      });
    });
    let tripCalls = 0;
    authJson.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/plan/current") {
        return { ok: true, criteria: null, itinerary: null };
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
      if (url === "/api/plan/trip" && init?.method === "POST") {
        tripCalls += 1;
        const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
        expect(body.skeleton_only).toBe(true);
        if (tripCalls === 1) {
          return {
            ok: true,
            trip_id: "trip-expand",
            revision: 1,
            status: "needs_input",
            need_input: { questions: [expandNeed] },
            phases: [
              { phase: "trip_created", trip_id: "trip-expand" },
              { phase: "skeleton_generating", trip_id: "trip-expand" },
            ],
          };
        }
        const answersBody = body.answers as { expand_radius?: string } | undefined;
        expect(answersBody?.expand_radius).toMatch(/^(yes|no)$/);
        expect(body.trip_id).toBe("trip-expand");
        const declined = answersBody?.expand_radius === "no";
        return {
          ok: true,
          trip_id: "trip-expand",
          revision: 2,
          status: "ready",
          phases: [
            { phase: "trip_created", trip_id: "trip-expand" },
            { phase: "skeleton_generating", trip_id: "trip-expand" },
            { phase: "skeleton_ready", trip_id: "trip-expand", revision: 2 },
          ],
          skeleton: declined
            ? {
                ...skeleton,
                deviations: [
                  {
                    field: "attraction_pool",
                    expected: "enough attractions",
                    actual: "thin local pool",
                    reason: "local-only after decline",
                  },
                ],
              }
            : skeleton,
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

  it("should_post_yes_and_continue_planning_when_affirmed (TC-T3-104-02)", async () => {
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await fillAndSubmit(getByTestId);

    await waitFor(() => expect(getByTestId("plan-need-chip-yes")).toBeTruthy());
    fireEvent.click(getByTestId("plan-need-chip-yes"));

    await waitFor(() => expect(getByTestId("plan-thread-skeleton")).toBeTruthy());
    const tripPosts = authJson.mock.calls.filter(
      (c) => c[0] === "/api/plan/trip" && (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(tripPosts.length).toBeGreaterThanOrEqual(2);
    const second = JSON.parse(String((tripPosts[1]![1] as RequestInit).body ?? "{}")) as {
      answers?: { expand_radius?: string };
    };
    expect(second.answers?.expand_radius).toBe("yes");
  });

  it("should_post_no_and_keep_deviations_when_declined (TC-T3-104-02)", async () => {
    const { getByTestId } = renderWithLocale(<PlanPageClient />);
    await waitFor(() => expect(getByTestId("plan-dest")).toBeTruthy());
    await fillAndSubmit(getByTestId);

    await waitFor(() => expect(getByTestId("plan-need-chip-no")).toBeTruthy());
    fireEvent.click(getByTestId("plan-need-chip-no"));

    await waitFor(() => expect(getByTestId("plan-thread-skeleton")).toBeTruthy());
    await waitFor(() => expect(getByTestId("plan-thread-complete")).toBeTruthy());
    await waitFor(() => expect(getByTestId("plan-thread-deviations")).toBeTruthy());
    expect(getByTestId("plan-thread-deviations").textContent).toMatch(/Candidate attraction list|候选景点清单/i);
    const tripPosts = authJson.mock.calls.filter(
      (c) => c[0] === "/api/plan/trip" && (c[1] as RequestInit | undefined)?.method === "POST",
    );
    const second = JSON.parse(String((tripPosts[1]![1] as RequestInit).body ?? "{}")) as {
      answers?: { expand_radius?: string };
    };
    expect(second.answers?.expand_radius).toBe("no");
  });
});
