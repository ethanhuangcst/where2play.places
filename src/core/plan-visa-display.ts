import { t } from "../i18n/catalog";
import { normalizeLocale, type Locale } from "./locales";
import { alpha3ToAlpha2 } from "./country-codes";
import { resolveNationalityLabel } from "./nationality-options";
import type { ArtifactsVisa } from "./plan-fetch-trip";

export type VisaTipsFact = { key: string; label: string; value: string };
export type VisaTipsList = { key: "documents" | "process"; label: string; items: string[] };

export type VisaTipsDisplay = {
  label: string;
  title: string;
  body: string;
  source: string;
  facts: VisaTipsFact[];
  lists: VisaTipsList[];
  sourceHref?: string;
  sourceHost?: string;
  verified?: string;
};

function countryLabel(locale: Locale, alpha3: string): string {
  const alpha2 = alpha3ToAlpha2(alpha3) ?? alpha3.slice(0, 2);
  return resolveNationalityLabel(locale, alpha3, alpha2);
}

function requirementTitle(locale: Locale, visa: ArtifactsVisa): string {
  const req = visa.requirement ?? "unknown";
  if (req === "visa_free") {
    const days = visa.visa_free_days;
    if (typeof days === "number" && days > 0) {
      return t(locale, "play.plan.travel_tips_visa_requirement.visa_free_days", { days });
    }
    return t(locale, "play.plan.travel_tips_visa_requirement.visa_free");
  }
  if (req === "visa_required") {
    return t(locale, "play.plan.travel_tips_visa_requirement.visa_required");
  }
  if (req === "special") {
    return t(locale, "play.plan.travel_tips_visa_requirement.special");
  }
  if (req === "e_visa") {
    return t(locale, "play.plan.travel_tips_visa_requirement.e_visa");
  }
  if (req === "visa_on_arrival") {
    return t(locale, "play.plan.travel_tips_visa_requirement.visa_on_arrival");
  }
  if (req === "eta") {
    return t(locale, "play.plan.travel_tips_visa_requirement.eta");
  }
  return t(locale, "play.plan.travel_tips_visa_requirement.unknown");
}

/** 107: home-country / Orizn not_applicable — no visa slot. visa_free stays visible. */
export function isHomeCountryVisa(visa: ArtifactsVisa): boolean {
  if (visa.requirement === "not_applicable") return true;
  return (
    /^[A-Z]{3}$/.test(visa.passport) &&
    /^[A-Z]{3}$/.test(visa.destination) &&
    visa.passport === visa.destination
  );
}

function sourceHost(href: string): string | undefined {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function verifiedDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function pushFact(
  facts: VisaTipsFact[],
  locale: Locale,
  key: string,
  value: string | undefined,
): void {
  if (!value) return;
  facts.push({
    key,
    label: t(locale, `play.plan.travel_tips_visa_section.${key}`),
    value,
  });
}

/** Map fetch artifacts.visa to 06-plan card 01 copy. Does not read artifacts.tips. */
export function visaTipsDisplay(
  visa: ArtifactsVisa | null | undefined,
  locale: string,
): VisaTipsDisplay | null {
  if (!visa) return null;
  if (isHomeCountryVisa(visa)) return null;
  const loc = normalizeLocale(locale);
  const passport = countryLabel(loc, visa.passport);
  const destination = countryLabel(loc, visa.destination);
  const title = requirementTitle(loc, visa);
  const facts: VisaTipsFact[] = [];
  pushFact(facts, loc, "processing_time", visa.processing_time);
  pushFact(facts, loc, "cost", visa.cost);
  pushFact(facts, loc, "validity", visa.validity);
  pushFact(facts, loc, "max_stay", visa.max_stay);
  if (visa.extension) {
    const possible = visa.extension.possible
      ? t(loc, "play.plan.travel_tips_visa_extension.possible")
      : t(loc, "play.plan.travel_tips_visa_extension.not_possible");
    const details = visa.extension.details?.trim();
    const value =
      details && details.includes(possible) ? details : details ? `${possible} — ${details}` : possible;
    pushFact(facts, loc, "extension", value);
  }
  pushFact(facts, loc, "embassy", visa.embassy);
  pushFact(facts, loc, "transit_visa", visa.transit_visa);

  const lists: VisaTipsList[] = [];
  if (visa.documents?.length) {
    lists.push({
      key: "documents",
      label: t(loc, "play.plan.travel_tips_visa_section.documents"),
      items: visa.documents,
    });
  }
  if (visa.process?.length) {
    lists.push({
      key: "process",
      label: t(loc, "play.plan.travel_tips_visa_section.process"),
      items: visa.process,
    });
  }

  const href = visa.source_url;
  const date = verifiedDate(visa.last_verified);
  return {
    // 107: surface requirement in the link so visa-free is visible without hover.
    label: t(loc, "play.plan.travel_tips_visa_link_with_requirement", {
      passport,
      destination,
      requirement: title,
    }),
    title,
    body: visa.description?.trim() ?? "",
    source: t(loc, "play.plan.travel_tips_visa_source"),
    facts,
    lists,
    ...(href ? { sourceHref: href, sourceHost: sourceHost(href) } : {}),
    ...(date ? { verified: t(loc, "play.plan.travel_tips_visa_verified", { date }) } : {}),
  };
}
