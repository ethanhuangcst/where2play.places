import { describe, expect, it } from "vitest";
import { t, catalogs } from "@/src/i18n/catalog";

const REGISTER_FIELD_KEYS = [
  "play.errors.name_required",
  "play.errors.email_required",
  "play.errors.email_invalid",
  "play.errors.email_taken",
  "play.errors.password_required",
  "play.errors.password_too_short",
  "play.errors.password_mismatch",
  "play.errors.age_required",
  "play.errors.age_out_of_range",
  "play.errors.photo_too_large",
  "play.errors.nationality_invalid",
  "play.errors.network",
  "play.errors.invalid_input",
] as const;

const NATIONALITY_COUNTRY_KEYS = [
  "play.nationality.country.CHN",
  "play.nationality.country.HKG",
  "play.nationality.country.TWN",
] as const;

const NATIONALITY_KEYS = [
  "play.register.nationality",
  "play.register.nationality_placeholder",
  "play.profile.nationality",
] as const;

describe("i18n catalogs", () => {
  it("should_differ_hk_and_tw_on_pinned_key", () => {
    expect(catalogs.HK["play.home.headline"]).not.toBe(catalogs.TW["play.home.headline"]);
  });

  it("should_interpolate_vars", () => {
    expect(t("EN", "play.header.hello", { name: "Mei" })).toContain("Mei");
  });

  it("should_define_register_field_errors_in_all_locales", () => {
    for (const locale of ["EN", "CN", "HK", "TW"] as const) {
      for (const key of REGISTER_FIELD_KEYS) {
        expect(catalogs[locale][key], `${locale} missing ${key}`).toBeTruthy();
      }
    }
  });

  it("TC-M11-38-06: should_define_nationality_keys_in_all_locales", () => {
    for (const locale of ["EN", "CN", "HK", "TW"] as const) {
      for (const key of NATIONALITY_KEYS) {
        expect(catalogs[locale][key], `${locale} missing ${key}`).toBeTruthy();
      }
      for (const key of NATIONALITY_COUNTRY_KEYS) {
        expect(catalogs[locale][key], `${locale} missing ${key}`).toBeTruthy();
      }
    }
  });

  it("should_define_plan_progressive_preview_keys_in_all_locales", () => {
    const keys = [
      "play.plan.arrange_planning_day",
      "play.plan.preview_place",
      "play.plan.preview_transit",
      "play.plan.preview_meal",
      "play.plan.meal_lunch",
      "play.plan.meal_afternoon_tea",
      "play.plan.meal_dinner",
    ] as const;
    for (const locale of ["EN", "CN", "HK", "TW"] as const) {
      for (const key of keys) {
        expect(catalogs[locale][key], `${locale} missing ${key}`).toBeTruthy();
      }
    }
    expect(t("CN", "play.plan.preview_place", { name: "大雁塔", reason: "地标", window: "09:30–11:00" })).toContain(
      "大雁塔",
    );
  });
});
