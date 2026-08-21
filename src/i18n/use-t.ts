"use client";

import { useLocaleStore } from "./locale-store";
import { getCatalog } from "./catalog";
import { type Locale } from "../core/locales";

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: string, vars?: Record<string, string | number>) => {
    const catalog = getCatalog(locale);
    let text = catalog[key] ?? getCatalog("EN")[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
}

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}
