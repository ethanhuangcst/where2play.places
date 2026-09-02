import { describe, expect, it } from "vitest";
import {
  buildNationalityOptions,
  filterNationalityOptions,
  resolveNationalityLabel,
} from "./nationality-options";

describe("nationality-options", () => {
  it("should_show_compliant_china_labels_in_cn_locale", () => {
    const options = buildNationalityOptions("CN");
    const labels = Object.fromEntries(options.map((o) => [o.code, o.label]));
    expect(labels.CHN).toBe("中国");
    expect(labels.HKG).toBe("中国香港");
    expect(labels.TWN).toBe("中国台湾");
  });

  it("should_pin_chn_hkg_twn_at_top", () => {
    const options = buildNationalityOptions("CN");
    expect(options.slice(0, 3).map((o) => o.code)).toEqual(["CHN", "HKG", "TWN"]);
    expect(options[0]?.pinned).toBe(true);
  });

  it("should_include_twn_in_catalog", () => {
    const options = buildNationalityOptions("EN");
    expect(options.some((o) => o.code === "TWN")).toBe(true);
  });

  it("should_fallback_to_display_names_for_other_countries", () => {
    const label = resolveNationalityLabel("EN", "USA", "US");
    expect(label).toBeTruthy();
    expect(label).not.toBe("play.nationality.country.USA");
  });

  it("should_filter_by_label_or_alpha3", () => {
    const options = buildNationalityOptions("CN");
    const china = filterNationalityOptions(options, "中国");
    expect(china.some((o) => o.code === "CHN")).toBe(true);
    expect(china.some((o) => o.code === "HKG")).toBe(true);
    const usa = filterNationalityOptions(options, "USA");
    expect(usa.some((o) => o.code === "USA")).toBe(true);
  });
});
