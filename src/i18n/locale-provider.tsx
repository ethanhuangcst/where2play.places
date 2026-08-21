"use client";

import { useLayoutEffect, useRef } from "react";
import { useLocaleStore } from "@/src/i18n/locale-store";
import { type Locale } from "@/src/core/locales";

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const seeded = useRef(false);
  if (!seeded.current) {
    useLocaleStore.setState({ locale: initialLocale });
    seeded.current = true;
  }

  useLayoutEffect(() => {
    useLocaleStore.setState({ locale: initialLocale });
  }, [initialLocale]);

  return <>{children}</>;
}
