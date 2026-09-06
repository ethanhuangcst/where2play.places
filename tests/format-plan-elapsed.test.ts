import { describe, expect, it } from "vitest";
import { formatPlanElapsedSeconds, friendlyMakeErrorKey, skeletonMakeErrorKey } from "../src/core/format-plan-elapsed";

describe("formatPlanElapsedSeconds", () => {
  it("should_format_elapsed_to_one_decimal", () => {
    expect(formatPlanElapsedSeconds(0)).toBe("0.0");
    expect(formatPlanElapsedSeconds(12400)).toBe("12.4");
    expect(formatPlanElapsedSeconds(100)).toBe("0.1");
  });
});

describe("friendlyMakeErrorKey", () => {
  it("should_map_timeout_and_failure_to_assistant_keys", () => {
    expect(friendlyMakeErrorKey("play.plan.phase_make_timeout")).toBe(
      "play.plan.assistant_make_timeout",
    );
    expect(friendlyMakeErrorKey("errors.make_itinerary_failed")).toBe(
      "play.plan.assistant_make_failed",
    );
    expect(friendlyMakeErrorKey("play.plan.assistant_fetch_failed")).toBe(
      "play.plan.assistant_fetch_failed",
    );
  });
});

describe("skeletonMakeErrorKey", () => {
  it("should_use_make_failed_when_make_fails_with_non_timeout", () => {
    expect(
      skeletonMakeErrorKey({
        makeOutcomeKey: "errors.make_itinerary_failed",
      }),
    ).toBe("errors.make_itinerary_failed");
  });

  it("should_use_phase_make_timeout_only_for_timeout_outcome", () => {
    expect(
      skeletonMakeErrorKey({
        makeOutcomeKey: "play.plan.phase_make_timeout",
      }),
    ).toBe("play.plan.phase_make_timeout");
    expect(
      skeletonMakeErrorKey({
        makeOutcomeKey: "errors.make_timeout",
      }),
    ).toBe("play.plan.phase_make_timeout");
  });
});
