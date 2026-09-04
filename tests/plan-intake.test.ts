import { describe, expect, it } from "vitest";
import { t } from "@/src/i18n/catalog";
import {
  INTAKE_DEFAULT_VALUES,
  INTAKE_STEP_ORDER,
  displayIntakeAnswer,
  intakeQaProgress,
  intakeQuickChips,
  intakeQuestionText,
  buildConstraintItems,
  joinMustIncludeSelection,
  mergeIntakeToBoundaries,
  nextIntakeStep,
  resolveIntakeAnswer,
  tripConstraintsFromIntakeStep,
} from "@/src/core/plan-intake";

describe("TC-M10-46-08 plan intake", () => {
  const tt = (key: string, vars?: Record<string, string | number>) => t("EN", key, vars);

  it("should_advance_through_eight_steps", () => {
    expect(nextIntakeStep(null)).toBe("b");
    let step: ReturnType<typeof nextIntakeStep> = "b";
    for (let i = 0; i < INTAKE_STEP_ORDER.length - 1; i++) {
      step = nextIntakeStep(step);
      expect(step).toBe(INTAKE_STEP_ORDER[i + 1]);
    }
    expect(nextIntakeStep("h")).toBeNull();
  });

  it("should_apply_defaults_when_skipped", () => {
    expect(resolveIntakeAnswer("c", INTAKE_DEFAULT_VALUES.c, tt)).toBe("09:00");
    expect(resolveIntakeAnswer("d", INTAKE_DEFAULT_VALUES.d, tt)).toBe(tt("play.plan.trip_type.city"));
    expect(resolveIntakeAnswer("e", INTAKE_DEFAULT_VALUES.e, tt)).toBe(tt("play.plan.pace.medium"));
    expect(resolveIntakeAnswer("f", INTAKE_DEFAULT_VALUES.f, tt)).toBe(tt("play.plan.transport.metro_walk"));
  });

  it("should_map_intake_to_plan_boundaries", () => {
    const takeoff = {
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "$$ Mid-range",
    };
    const answers = {
      b: "Hills Hotel",
      c: "09:30",
      d: tt("play.plan.trip_type.couple"),
      e: tt("play.plan.pace.medium"),
      f: tt("play.plan.transport.metro_walk"),
      g: "Belém Tower, Jerónimos",
      h: "",
    };
    const boundaries = mergeIntakeToBoundaries(takeoff, answers, tt, "EN");
    expect(boundaries.destination).toBe("Lisbon");
    expect(boundaries.dailyStart).toBe("Hills Hotel");
    expect(boundaries.timeFrom).toBe("09:30");
    expect(boundaries.tripType).toBe(tt("play.plan.trip_type.couple"));
    expect(boundaries.mustInclude).toEqual(["Belém Tower", "Jerónimos"]);
  });

  it("should_normalize_time_from_to_hh_mm", () => {
    const takeoff = {
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "$$ Mid-range",
    };
    const boundaries = mergeIntakeToBoundaries(takeoff, { c: "9:30" }, tt, "EN");
    expect(boundaries.timeFrom).toBe("09:30");
  });

  it("TC-M18-77-01 should_coerce_colloquial_times", () => {
    const takeoff = {
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "mid",
    };
    expect(mergeIntakeToBoundaries(takeoff, { c: "7:00 am" }, tt, "EN").timeFrom).toBe("07:00");
    expect(mergeIntakeToBoundaries(takeoff, { c: "7am" }, tt, "EN").timeFrom).toBe("07:00");
    expect(mergeIntakeToBoundaries(takeoff, { c: "早上七点" }, tt, "EN").timeFrom).toBe("07:00");
    expect(mergeIntakeToBoundaries(takeoff, { c: "七点半" }, tt, "EN").timeFrom).toBe("07:30");
    expect(mergeIntakeToBoundaries(takeoff, { c: "not-a-time" }, tt, "EN").timeFrom).toBe("09:00");
  });

  it("TC-M20-41-03 should_keep_must_see_constraint_null_when_unanswered_even_if_suggestions", () => {
    const takeoff = {
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "$$ Mid-range",
    };
    const items = buildConstraintItems(
      takeoff,
      {},
      tt,
      false,
      ["Belém Tower", "Jerónimos Monastery"],
    );
    const mustSee = items.find((i) => i.key === "mustSee");
    expect(mustSee?.value).toBeNull();
    expect(mustSee?.pending).toBe(true);
  });

  it("TC-M19-40-01 should_not_copy_suggested_chips_into_mustInclude_when_step_g_empty", () => {
    const takeoff = {
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "$$ Mid-range",
    };
    const boundaries = mergeIntakeToBoundaries(
      takeoff,
      { g: "" },
      tt,
      "EN",
      ["Belém Tower", "Jerónimos Monastery"],
    );
    expect(boundaries.mustInclude).toBeUndefined();
  });

  it("TC-M19-40-01 should_keep_user_typed_mustInclude_only", () => {
    const takeoff = {
      destination: "Lisbon",
      startDate: "2026-09-20",
      days: 4,
      partySize: 2,
      budget: "$$ Mid-range",
    };
    const boundaries = mergeIntakeToBoundaries(
      takeoff,
      { g: "Belém Tower, Jerónimos, Sintra" },
      tt,
      "EN",
      ["Tower A", "Tower B", "Tower C", "Tower D"],
    );
    expect(boundaries.mustInclude).toEqual(["Belém Tower", "Jerónimos", "Sintra"]);
  });

  it("should_join_multiselect_must_see_with_typed_text", () => {
    expect(joinMustIncludeSelection(["Sintra", "Cascais"], "Belém Tower")).toBe(
      "Sintra、Cascais、Belém Tower",
    );
    expect(joinMustIncludeSelection([], "")).toBe("");
  });

  it("should_expose_must_see_chips_from_suggestions", () => {
    const chips = intakeQuickChips("g", tt, ["Tower A", "Tower B"]);
    expect(chips).toHaveLength(2);
    expect(chips[0]?.value).toBe("Tower A");
  });

  it("should_embed_examples_in_step_g_question", () => {
    const q = intakeQuestionText("g", tt, ["Sintra", "Cascais"]);
    expect(q).toContain("Sintra");
    expect(q).toContain("Cascais");
  });

  it("should_expose_quick_chips_for_steps_d_e_f", () => {
    expect(intakeQuickChips("d", tt)).toHaveLength(4);
    expect(intakeQuickChips("e", tt)).toHaveLength(3);
    expect(intakeQuickChips("f", tt)).toHaveLength(3);
    expect(intakeQuickChips("b", tt)).toHaveLength(0);
  });

  it("should_track_qa_progress", () => {
    expect(intakeQaProgress("b", false)).toEqual({ current: 1, total: 8 });
    expect(intakeQaProgress("e", false)).toEqual({ current: 4, total: 8 });
    expect(intakeQaProgress(null, true)).toEqual({ current: 8, total: 8 });
  });

  it("should_format_display_answers_for_bubbles", () => {
    expect(displayIntakeAnswer("b", "", tt)).toBe(tt("play.plan.constraint_no_hotel"));
    expect(displayIntakeAnswer("c", "09:30", tt)).toBe("09:30");
  });

  it("should_offer_retry_and_skip_chips_when_origin_not_found", () => {
    const chips = intakeQuickChips("b", tt, undefined, { originNotFound: true });
    expect(chips.map((c) => c.labelKey)).toEqual([
      "play.plan.intake_origin_retry",
      "play.plan.intake_origin_skip",
    ]);
    expect(chips[1]?.value).toBe("");
  });

  it("should_map_intake_step_to_trip_constraint_patch", () => {
    expect(tripConstraintsFromIntakeStep("c", "10:00", tt)).toEqual({ timeFrom: "10:00" });
    expect(tripConstraintsFromIntakeStep("g", "A、B", tt)).toEqual({ must_include: ["A", "B"] });
  });
});
