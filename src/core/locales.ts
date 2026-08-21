export const LOCALES = ["EN", "CN", "HK", "TW"] as const;
export type Locale = (typeof LOCALES)[number];

export const AGENT_ID = "places-agent";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (value && isLocale(value)) return value;
  return "EN";
}

export function htmlLang(locale: Locale): string {
  switch (locale) {
    case "CN":
      return "zh-CN";
    case "HK":
      return "zh-HK";
    case "TW":
      return "zh-TW";
    default:
      return "en";
  }
}
