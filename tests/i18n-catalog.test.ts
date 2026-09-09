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
    expect(CN["play.plan.budget"]).toBe("行程预算");
    expect(CN["play.plan.pace"]).toBe("动线节奏");
    expect(CN["play.plan.other"]).toBe("其他要求");
    expect(CN["play.plan.constraint_hotel"]).toBe("每日起点");
    expect(CN["play.plan.constraint_day_start"]).toBe("每日出发时间");
    expect(CN["play.plan.constraint_days"]).toBe("行程天数");
    expect(CN["play.plan.constraint_party"]).toBe("出行人数");
  });
});

describe("i18n constraint pending", () => {
  it("should_define_constraint_pending_in_all_locales", () => {
    expect(EN["play.plan.constraint_pending"]).toBeTruthy();
    expect(CN["play.plan.constraint_pending"]).toBeTruthy();
    expect(HK["play.plan.constraint_pending"]).toBeTruthy();
    expect(TW["play.plan.constraint_pending"]).toBeTruthy();
  });
});

describe("i18n need nav and provider (2play-plan-97/98)", () => {
  it("should_define_skip_redo_and_provider_keys", () => {
    for (const key of [
      "play.plan.need_skip_this",
      "play.plan.need_redo_prev",
      "play.plan.need_skip_hint",
      "play.plan.provider.google",
      "play.plan.provider.amap",
      "play.plan.provider.none",
    ] as const) {
      expect(EN[key]).toBeTruthy();
      expect(CN[key]).toBeTruthy();
      expect(HK[key]).toBeTruthy();
      expect(TW[key]).toBeTruthy();
    }
  });
});

describe("i18n narrative keys (TC-M19-40-06)", () => {
  it("should_define_mvp19_narrative_keys_in_all_locales", () => {
    for (const key of NARRATIVE_KEYS) {
      expect(EN[key as keyof typeof EN]).toBeTruthy();
      expect(CN[key as keyof typeof CN]).toBeTruthy();
      expect(HK[key as keyof typeof HK]).toBeTruthy();
      expect(TW[key as keyof typeof TW]).toBeTruthy();
    }
  });
});
