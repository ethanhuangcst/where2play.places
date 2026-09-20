import { describe, expect, it } from "vitest";
import { formatDestVerifiedLabel } from "../src/core/plan-dest-label";

describe("formatDestVerifiedLabel", () => {
  it("should_format_domestic_without_english_paren", () => {
    expect(
      formatDestVerifiedLabel({ country: "中国台湾", city: "台北" }),
    ).toBe("中国台湾/台北");
  });

  it("should_append_city_en_when_different", () => {
    expect(
      formatDestVerifiedLabel({
        country: "葡萄牙",
        city: "里斯本",
        city_en: "Lisbon",
      }),
    ).toBe("葡萄牙/里斯本(Lisbon)");
  });

  it("should_return_null_when_country_or_city_missing", () => {
    expect(formatDestVerifiedLabel({ country: "Portugal" })).toBeNull();
    expect(formatDestVerifiedLabel({ city: "Lisbon" })).toBeNull();
  });

  it("should_collapse_city_state_when_country_equals_city", () => {
    expect(
      formatDestVerifiedLabel({ country: "香港", city: "香港" }),
    ).toBe("香港");
    expect(
      formatDestVerifiedLabel({
        country: "香港",
        city: "香港",
        city_en: "Hong Kong",
      }),
    ).toBe("香港(Hong Kong)");
  });
});
