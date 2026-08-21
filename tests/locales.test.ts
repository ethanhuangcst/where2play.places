import { describe, expect, it } from "vitest";
import { htmlLang, isLocale, normalizeLocale } from "../src/core/locales";

describe("locales", () => {
  it("should_normalize_known_locale", () => {
    expect(normalizeLocale("CN")).toBe("CN");
    expect(normalizeLocale("xx")).toBe("EN");
    expect(normalizeLocale(undefined)).toBe("EN");
  });

  it("should_map_html_lang", () => {
    expect(htmlLang("EN")).toBe("en");
    expect(htmlLang("CN")).toBe("zh-CN");
    expect(htmlLang("HK")).toBe("zh-HK");
    expect(htmlLang("TW")).toBe("zh-TW");
  });

  it("should_detect_locale_membership", () => {
    expect(isLocale("EN")).toBe(true);
    expect(isLocale("FR")).toBe(false);
  });
});
