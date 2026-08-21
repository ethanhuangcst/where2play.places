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
  "play.errors.network",
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
});
