import { describe, expect, it } from "vitest";
import { toCityLabel } from "@/src/core/city-label";

describe("toCityLabel", () => {
  it("should_keep_city_when_chinese_shi_present", () => {
    expect(toCityLabel("上海市徐汇区漕溪北路")).toBe("上海市");
  });

  it("should_keep_last_two_parts_when_english_street_address", () => {
    expect(toCityLabel("221B Baker Street, London, United Kingdom")).toBe(
      "London, United Kingdom",
    );
  });

  it("should_keep_short_labels", () => {
    expect(toCityLabel("Central, Hong Kong")).toBe("Central, Hong Kong");
  });
});
