"use client";

import { LOCALES, type Locale } from "@/src/core/locales";
import { useLocale, useT } from "@/src/i18n/use-t";
import { persistLocale } from "@/src/i18n/locale-store";
import { useRouter } from "next/navigation";

export function LocaleSwitch() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  async function setLocale(next: Locale) {
    await persistLocale(next);
    router.refresh();
  }

  return (
    <div className="locale-switch" role="group" aria-label={t("play.a11y.locale")}>
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          className={locale === loc ? "is-active" : ""}
          data-locale={loc}
          data-testid={`locale-${loc}`}
          aria-pressed={locale === loc}
          onClick={() => setLocale(loc)}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
