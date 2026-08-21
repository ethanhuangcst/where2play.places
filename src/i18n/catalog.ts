import EN from "../../messages/EN.json";
import CN from "../../messages/CN.json";
import HK from "../../messages/HK.json";
import TW from "../../messages/TW.json";
import { type Locale, normalizeLocale } from "../core/locales";

const catalogs: Record<Locale, Record<string, string>> = { EN, CN, HK, TW };

export function t(locale: Locale | string, key: string, vars?: Record<string, string | number>): string {
  const loc = normalizeLocale(typeof locale === "string" ? locale : "EN");
  let text = catalogs[loc][key] ?? catalogs.EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function getCatalog(locale: Locale): Record<string, string> {
  return catalogs[locale];
}

export { catalogs };
