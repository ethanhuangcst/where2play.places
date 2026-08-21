"use client";

import { create } from "zustand";
import { type Locale } from "../core/locales";

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "EN",
  setLocale: (locale) => set({ locale }),
}));

export async function persistLocale(locale: Locale): Promise<void> {
  document.cookie = `where2play_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
  useLocaleStore.getState().setLocale(locale);
  await fetch("/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale }),
  });
}
