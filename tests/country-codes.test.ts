import { describe, expect, it } from "vitest";
import { PASSPORT_COUNTRY_CODES, isValidNationality } from "@/src/core/country-codes";

describe("country-codes", () => {
  it("should_expose_non_empty_passport_code_list", () => {
    expect(PASSPORT_COUNTRY_CODES.length).toBeGreaterThan(100);
  });

  it("should_include_chn_usa_and_twn", () => {
    expect(PASSPORT_COUNTRY_CODES).toContain("CHN");
    expect(PASSPORT_COUNTRY_CODES).toContain("USA");
    expect(PASSPORT_COUNTRY_CODES).toContain("TWN");
  });

  it("should_accept_empty_nationality_as_optional", () => {
    expect(isValidNationality("")).toBe(true);
    expect(isValidNationality(undefined)).toBe(true);
  });

  it("should_reject_unknown_alpha3", () => {
    expect(isValidNationality("ZZZ")).toBe(false);
  });
});
