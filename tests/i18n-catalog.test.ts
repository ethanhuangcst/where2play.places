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

const STORY4_KEYS = [
  "play.plan.assistant_know_enough",
  "play.plan.assistant_planning_skeleton",
  "play.plan.assistant_skeleton_headline",
  "play.plan.assistant_make_elapsed",
  "play.plan.assistant_make_timeout",
  "play.plan.assistant_make_failed",
  "play.plan.assistant_fetch_failed",
] as const;

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

describe("i18n origin lookup (TC-M21-41-23)", () => {
  it("should_define_origin_not_found_retry_skip_in_all_locales", () => {
    for (const key of [
      "play.plan.intake_origin_not_found",
      "play.plan.intake_origin_retry",
      "play.plan.intake_origin_skip",
    ] as const) {
      expect(EN[key]).toBeTruthy();
      expect(CN[key]).toBeTruthy();
      expect(HK[key]).toBeTruthy();
      expect(TW[key]).toBeTruthy();
    }
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
