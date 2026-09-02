import { htmlLang, type Locale } from "./locales";
import { PASSPORT_COUNTRIES } from "./country-codes";
import { t } from "../i18n/catalog";

/** Pinned at top; stored values remain ISO alpha-3 for Orizn / visa. */
export const CHINA_NATIONALITY_CODES = ["CHN", "HKG", "TWN"] as const;

export type NationalityOption = {
  code: string;
  label: string;
  pinned: boolean;
};

export function nationalityCountryKey(alpha3: string): string {
  return `play.nationality.country.${alpha3}`;
}

function displayNamesFor(locale: Locale): Intl.DisplayNames {
  const displayLocale = htmlLang(locale);
  try {
    return new Intl.DisplayNames([displayLocale], { type: "region" });
  } catch {
    return new Intl.DisplayNames(["en"], { type: "region" });
  }
}

/** i18n override for CHN/HKG/TWN; DisplayNames fallback for all other codes. */
export function resolveNationalityLabel(
  locale: Locale,
  alpha3: string,
  alpha2: string,
  names: Intl.DisplayNames = displayNamesFor(locale),
): string {
  const key = nationalityCountryKey(alpha3);
  const localized = t(locale, key);
  if (localized !== key) return localized;
  return names.of(alpha2) ?? alpha3;
}

export function buildNationalityOptions(locale: Locale): NationalityOption[] {
  const names = displayNamesFor(locale);
  const displayLocale = htmlLang(locale);
  const pinnedSet = new Set<string>(CHINA_NATIONALITY_CODES);
  const byCode = new Map<string, NationalityOption>();

  for (const { alpha3, alpha2 } of PASSPORT_COUNTRIES) {
    byCode.set(alpha3, {
      code: alpha3,
      label: resolveNationalityLabel(locale, alpha3, alpha2, names),
      pinned: pinnedSet.has(alpha3),
    });
  }

  const pinned = CHINA_NATIONALITY_CODES.map((code) => byCode.get(code)).filter(
    (o): o is NationalityOption => Boolean(o),
  );
  const rest = [...byCode.values()]
    .filter((o) => !pinnedSet.has(o.code))
    .sort((a, b) => a.label.localeCompare(b.label, displayLocale));

  return [...pinned, ...rest];
}

/** Match localized label or ISO alpha-3 (case-insensitive). */
export function filterNationalityOptions(
  options: NationalityOption[],
  query: string,
): NationalityOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
  );
}

export function findNationalityOption(
  options: NationalityOption[],
  code: string,
): NationalityOption | undefined {
  if (!code) return undefined;
  return options.find((o) => o.code === code);
}
