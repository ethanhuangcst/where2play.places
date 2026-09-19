import { describe, expect, it } from "vitest";
import EN from "../messages/EN.json";
import CN from "../messages/CN.json";
import HK from "../messages/HK.json";
import TW from "../messages/TW.json";

const NARRATIVE_KEYS = [
  "play.plan.assistant_know_enough",
  "play.plan.assistant_making",
  "play.plan.assistant_skeleton_ready",
  "play.plan.assistant_plan_complete",
  "play.plan.assistant_discovering",
  "play.plan.assistant_filling_stop",
  "play.plan.phase_making",
] as const;

const F85_MEAL_SLOT_KEYS = [
  "play.plan.meal_slot_lunch",
  "play.plan.meal_slot_dinner",
  "play.plan.meal_slot_afternoon_tea",
] as const;

const STORY4_KEYS = [
  "play.plan.assistant_know_enough",
  "play.plan.assistant_planning_skeleton",
  "play.plan.assistant_skeleton_headline",
  "play.plan.assistant_make_elapsed",
  "play.plan.assistant_make_timeout",
  "play.plan.assistant_make_failed",
  "play.plan.assistant_fetch_failed",
] as const;

const REPLAN_ONLY_KEYS = [
  "play.plan.assistant_next_hint",
  "play.plan.replan_soft",
  "play.chat.send",
  "play.chat.input_label",
] as const;

const REMOVED_REFINE_KEYS = [
  "play.chat.placeholder",
  "play.chat.refine_in_progress",
  "play.chat.refine_no_change",
  "play.plan.composer_ready_ph",
  "play.errors.chat_failed",
] as const;

describe("i18n replan-only keys (ADR-071)", () => {
  it("should_define_replan_and_need_input_composer_keys_in_all_locales", () => {
    for (const key of REPLAN_ONLY_KEYS) {
      expect(EN[key as keyof typeof EN]).toBeTruthy();
      expect(CN[key as keyof typeof CN]).toBeTruthy();
      expect(HK[key as keyof typeof HK]).toBeTruthy();
      expect(TW[key as keyof typeof TW]).toBeTruthy();
    }
  });

  it("should_not_define_removed_refine_chat_keys", () => {
    for (const key of REMOVED_REFINE_KEYS) {
      expect(EN).not.toHaveProperty(key);
      expect(CN).not.toHaveProperty(key);
      expect(HK).not.toHaveProperty(key);
      expect(TW).not.toHaveProperty(key);
    }
  });

  it("should_use_replan_only_next_hint_copy_in_cn", () => {
    expect(CN["play.plan.assistant_next_hint"]).toMatch(/重新规划/);
    expect(CN["play.plan.assistant_next_hint"]).not.toMatch(/输入框/);
  });
});

describe("i18n F85 meal slot labels (TC-M22-85-04)", () => {
  it("should_define_meal_slot_keys_in_all_locales", () => {
    for (const key of F85_MEAL_SLOT_KEYS) {
      expect(EN[key]).toBeTruthy();
      expect(CN[key]).toBeTruthy();
      expect(HK[key]).toBeTruthy();
      expect(TW[key]).toBeTruthy();
    }
  });
});

describe("i18n Story 4 skeleton copy (TC-M20-41-20)", () => {
  it("should_define_planning_headline_elapsed_and_errors_in_all_locales", () => {
    for (const key of STORY4_KEYS) {
      expect(EN[key as keyof typeof EN]).toBeTruthy();
      expect(CN[key as keyof typeof CN]).toBeTruthy();
      expect(HK[key as keyof typeof HK]).toBeTruthy();
      expect(TW[key as keyof typeof TW]).toBeTruthy();
    }
  });
});

describe("i18n MVP-T2 takeoff 11 (TC-T2-100-07)", () => {
  it("should_define_takeoff_eleven_field_keys_in_all_locales", () => {
    for (const key of [
      "play.plan.start_time",
      "play.plan.origin",
      "play.plan.other",
      "play.plan.origin_ph",
      "play.plan.other_ph",
      "play.plan.dest_geocode_failed",
      "play.plan.origin_overlay_title",
      "play.plan.start_day",
      "play.plan.trip_type_short",
      "play.plan.trip_days",
      "play.plan.party_travel",
      "play.plan.constraint_days",
      "play.plan.constraint_party",
      "play.plan.constraint_hotel",
      "play.plan.constraint_day_start",
    ] as const) {
      expect(EN[key]).toBeTruthy();
      expect(CN[key]).toBeTruthy();
      expect(HK[key]).toBeTruthy();
      expect(TW[key]).toBeTruthy();
    }
  });

  it("should_align_cn_labels_with_mock_copy", () => {
    expect(CN["play.plan.start_day"]).toBe("行程开始日期");
    expect(CN["play.plan.trip_type_short"]).toBe("行程类型");
    expect(CN["play.plan.trip_days"]).toBe("天数");
    expect(CN["play.plan.party_travel"]).toBe("人数");
  });
});

describe("i18n narrative keys (TC-M20-41-20)", () => {
  it("should_define_narrative_keys_in_all_locales", () => {
    for (const key of NARRATIVE_KEYS) {
      expect(EN[key]).toBeTruthy();
      expect(CN[key]).toBeTruthy();
      expect(HK[key]).toBeTruthy();
      expect(TW[key]).toBeTruthy();
    }
  });
});
