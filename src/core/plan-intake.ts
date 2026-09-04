import type { PlanBoundaries } from "./itinerary-types";
import { coerceAgentTime } from "./coerce-agent-time";
import { budgetOptionLabel, normalizeBudgetKey, type BudgetOptionKey } from "./plan-budget";
import { ORIGIN_RETRY_CHIP } from "./plan-resolve-origin";

/** Assistant steps b–h per performance.md §12.11 / 2play-design §4.2.1 */
export type IntakeStepId = "b" | "c" | "d" | "e" | "f" | "g" | "h";

export const INTAKE_STEP_ORDER: IntakeStepId[] = ["b", "c", "d", "e", "f", "g", "h"];

export type IntakeAnswers = Partial<Record<IntakeStepId, string | undefined>>;

export type TakeoffFields = {
  destination: string;
  startDate: string;
  days: number;
  partySize: number;
  budget: string;
};

/** i18n keys for default option labels (resolved at UI layer). */
export const INTAKE_DEFAULT_I18N: Record<IntakeStepId, string> = {
  b: "play.plan.intake_default_hotel",
  c: "play.plan.intake_default_time",
  d: "play.plan.trip_type.city",
  e: "play.plan.pace.medium",
  f: "play.plan.transport.metro_walk",
  g: "play.plan.intake_default_must_see",
  h: "play.plan.intake_default_other",
};

/** Canonical stored values when user picks「使用默认」. */
export const INTAKE_DEFAULT_VALUES: Record<IntakeStepId, string> = {
  b: "",
  c: "09:00",
  d: "__default_trip_type__",
  e: "__default_pace__",
  f: "__default_transport__",
  g: "",
  h: "",
};

export type IntakeQuestionKey = `play.plan.assistant_q_${IntakeStepId}`;

export function intakeQuestionKey(step: IntakeStepId): IntakeQuestionKey {
  return `play.plan.assistant_q_${step}`;
}

export function intakeQuestionText(
  step: IntakeStepId,
  t: (key: string, vars?: Record<string, string>) => string,
  suggestedMustSee?: string[],
): string {
  if (step === "g" && suggestedMustSee?.length) {
    const examples = suggestedMustSee.slice(0, 3).join("，");
    return t("play.plan.assistant_q_g_examples", { examples });
  }
  return t(intakeQuestionKey(step));
}

export function isIntakeStepComplete(answers: IntakeAnswers, step: IntakeStepId): boolean {
  return step in answers;
}

export function intakeStepIndex(step: IntakeStepId): number {
  return INTAKE_STEP_ORDER.indexOf(step);
}

export function nextIntakeStep(current: IntakeStepId | null): IntakeStepId | null {
  if (current == null) return INTAKE_STEP_ORDER[0] ?? null;
  const idx = intakeStepIndex(current);
  if (idx < 0 || idx >= INTAKE_STEP_ORDER.length - 1) return null;
  return INTAKE_STEP_ORDER[idx + 1] ?? null;
}

function resolveDefaultTripType(t: (key: string) => string): string {
  return t("play.plan.trip_type.city");
}

function resolveDefaultPace(t: (key: string) => string): string {
  return t("play.plan.pace.medium");
}

function resolveDefaultTransport(t: (key: string) => string): string {
  return t("play.plan.transport.metro_walk");
}

function parseMustInclude(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const items = raw
    .split(/[,，、;；\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function normalizeTime(raw: string): string {
  return coerceAgentTime(raw, "09:00");
}

function resolveMustInclude(raw: string | undefined): string[] | undefined {
  return parseMustInclude(raw);
}

function formatMustSeeList(places: string[], t: (key: string, vars?: Record<string, string>) => string): string {
  return t("play.plan.must_see_suggestions", { places: places.join(" · ") });
}

function formatBudgetDisplay(raw: string, t: (key: string) => string): string {
  const key = normalizeBudgetKey(raw);
  if (key) return budgetOptionLabel(key, t);
  return raw;
}

export function resolveIntakeAnswer(
  step: IntakeStepId,
  raw: string | undefined,
  t: (key: string) => string,
): string {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === INTAKE_DEFAULT_VALUES[step] || trimmed === "") {
    if (step === "d") return resolveDefaultTripType(t);
    if (step === "e") return resolveDefaultPace(t);
    if (step === "f") return resolveDefaultTransport(t);
    if (step === "c") return "09:00";
    return trimmed;
  }
  return trimmed;
}

/** Trip Store constraint patch for one intake answer (AC7). */
export function tripConstraintsFromIntakeStep(
  step: IntakeStepId,
  raw: string | undefined,
  t: (key: string) => string,
): Record<string, unknown> {
  const resolved = resolveIntakeAnswer(step, raw, t);
  switch (step) {
    case "b":
      return { hotel: resolved, dailyStart: resolved };
    case "c":
      return { timeFrom: normalizeTime(resolved || "09:00") };
    case "d":
      return { tripType: resolved };
    case "e":
      return { pace: resolved };
    case "f":
      return { transport: resolved };
    case "g":
      return { must_include: resolveMustInclude(resolved) ?? [] };
    case "h":
      return { notes: resolved };
    default:
      return {};
  }
}

export function mergeIntakeToBoundaries(
  takeoff: TakeoffFields,
  answers: IntakeAnswers,
  t: (key: string) => string,
  locale?: string,
  suggestedMustSee?: string[],
): PlanBoundaries {
  const hotel = resolveIntakeAnswer("b", answers.b, t);
  const timeFrom = normalizeTime(resolveIntakeAnswer("c", answers.c, t) || "09:00");
  const tripType = resolveIntakeAnswer("d", answers.d, t);
  const pace = resolveIntakeAnswer("e", answers.e, t);
  const transport = resolveIntakeAnswer("f", answers.f, t);
  const mustRaw = resolveIntakeAnswer("g", answers.g, t);
  const constraintsRaw = resolveIntakeAnswer("h", answers.h, t);
  const mustInclude = resolveMustInclude(mustRaw);

  return {
    destination: takeoff.destination.trim(),
    startDate: takeoff.startDate,
    days: takeoff.days,
    partySize: takeoff.partySize,
    budget: takeoff.budget,
    ...(hotel ? { dailyStart: hotel } : {}),
    timeFrom,
    tripType,
    pace,
    transport,
    ...(mustInclude?.length ? { mustInclude } : {}),
    ...(constraintsRaw ? { constraints: constraintsRaw.slice(0, 500) } : {}),
    ...(locale ? { locale } : {}),
  };
}

export type ConstraintDisplayItem = {
  key: string;
  labelKey: string;
  value: string | null;
  pending: boolean;
};

export function buildConstraintItems(
  takeoff: TakeoffFields,
  answers: IntakeAnswers,
  t: (key: string) => string,
  intakeComplete: boolean,
  _suggestedMustSee?: string[],
): ConstraintDisplayItem[] {
  const show = (step: IntakeStepId | null, value: string | null, pending: boolean) => ({
    value,
    pending: !intakeComplete && pending,
  });

  const hotelAns = answers.b;
  const hotelResolved = hotelAns !== undefined ? resolveIntakeAnswer("b", hotelAns, t) : undefined;
  const hotelDisplay =
    hotelAns === undefined && !intakeComplete
      ? null
      : hotelResolved
        ? hotelResolved
        : t("play.plan.constraint_no_hotel");

  const dayStartAns = answers.c;
  const dayStart =
    dayStartAns === undefined && !intakeComplete
      ? null
      : resolveIntakeAnswer("c", dayStartAns, t) || "09:00";

  const tripTypeAns = answers.d;
  const tripType =
    tripTypeAns === undefined && !intakeComplete
      ? null
      : resolveIntakeAnswer("d", tripTypeAns, t);

  const paceAns = answers.e;
  const pace =
    paceAns === undefined && !intakeComplete ? null : resolveIntakeAnswer("e", paceAns, t);

  const transportAns = answers.f;
  const transport =
    transportAns === undefined && !intakeComplete
      ? null
      : resolveIntakeAnswer("f", transportAns, t);

  const mustAns = answers.g;
  const mustResolved = resolveMustInclude(resolveIntakeAnswer("g", mustAns, t));
  const mustInclude =
    mustAns === undefined && !intakeComplete
      ? null
      : mustResolved?.join("、") ?? t("play.plan.constraint_must_see_default");

  const otherAns = answers.h;
  const other =
    otherAns === undefined && !intakeComplete
      ? null
      : resolveIntakeAnswer("h", otherAns, t) || t("play.plan.constraint_none");

  return [
    { key: "destination", labelKey: "play.plan.destination", ...show(null, takeoff.destination, false) },
    { key: "startDate", labelKey: "play.plan.start_date", ...show(null, takeoff.startDate, false) },
    { key: "days", labelKey: "play.plan.days", ...show(null, String(takeoff.days), false) },
    {
      key: "partySize",
      labelKey: "play.plan.party",
      ...show(null, String(takeoff.partySize), false),
    },
    { key: "budget", labelKey: "play.plan.budget", ...show(null, formatBudgetDisplay(takeoff.budget, t), false) },
    { key: "hotel", labelKey: "play.plan.constraint_hotel", ...show("b", hotelDisplay, hotelAns === undefined) },
    {
      key: "dayStart",
      labelKey: "play.plan.constraint_day_start",
      ...show("c", dayStart, dayStartAns === undefined),
    },
    {
      key: "tripType",
      labelKey: "play.plan.constraint_trip_type",
      ...show("d", tripType, tripTypeAns === undefined),
    },
    { key: "pace", labelKey: "play.plan.constraint_pace", ...show("e", pace, paceAns === undefined) },
    {
      key: "transport",
      labelKey: "play.plan.constraint_transport",
      ...show("f", transport, transportAns === undefined),
    },
    {
      key: "mustSee",
      labelKey: "play.plan.constraint_must_see",
      ...show("g", mustInclude, mustAns === undefined),
    },
    {
      key: "other",
      labelKey: "play.plan.constraint_other",
      ...show("h", other, otherAns === undefined),
    },
  ];
}

export function takeoffIsValid(takeoff: TakeoffFields): boolean {
  return (
    Boolean(takeoff.destination.trim()) &&
    Boolean(takeoff.startDate) &&
    Number.isInteger(takeoff.days) &&
    takeoff.days >= 1 &&
    takeoff.days <= 14 &&
    takeoff.partySize >= 1 &&
    Boolean(takeoff.budget)
  );
}

export type IntakeQuickChip = {
  labelKey?: string;
  /** Domain place name from travel tips — not an i18n key. */
  label?: string;
  value: string;
};

const MUST_SEE_CHIP_LIMIT = 5;

export function joinMustIncludeSelection(selected: string[], typed: string): string {
  const parts = [...selected];
  if (typed) {
    for (const item of typed.split(/[,，、;；\n]/).map((s) => s.trim()).filter(Boolean)) {
      if (!parts.includes(item)) parts.push(item);
    }
  }
  return parts.join("、");
}

/** Quick-answer chips for assistant steps d/e/f/g (mock `plan-nav__quick`). */
export function intakeQuickChips(
  step: IntakeStepId,
  t: (key: string) => string,
  suggestedMustSee?: string[],
  opts?: { originNotFound?: boolean },
): IntakeQuickChip[] {
  if (step === "b" && opts?.originNotFound) {
    return [
      { labelKey: "play.plan.intake_origin_retry", value: ORIGIN_RETRY_CHIP },
      { labelKey: "play.plan.intake_origin_skip", value: "" },
    ];
  }
  switch (step) {
    case "d":
      return [
        { labelKey: "play.plan.chip.trip_city", value: t("play.plan.trip_type.city") },
        { labelKey: "play.plan.chip.trip_solo", value: t("play.plan.trip_type.solo") },
        { labelKey: "play.plan.chip.trip_family", value: t("play.plan.trip_type.family") },
        { labelKey: "play.plan.chip.trip_couple", value: t("play.plan.trip_type.couple") },
      ];
    case "e":
      return [
        { labelKey: "play.plan.chip.pace_relaxed", value: t("play.plan.pace.relaxed") },
        { labelKey: "play.plan.chip.pace_medium", value: t("play.plan.pace.medium") },
        { labelKey: "play.plan.chip.pace_tight", value: t("play.plan.pace.tight") },
      ];
    case "f":
      return [
        { labelKey: "play.plan.chip.transport_metro", value: t("play.plan.transport.metro_walk") },
        { labelKey: "play.plan.chip.transport_walk", value: t("play.plan.transport.walk") },
        { labelKey: "play.plan.chip.transport_taxi", value: t("play.plan.transport.taxi") },
      ];
    case "g":
      return (suggestedMustSee ?? [])
        .slice(0, MUST_SEE_CHIP_LIMIT)
        .map((name) => ({ label: name, value: name }));
    default:
      return [];
  }
}

export function mustSeeDefaultHint(
  suggestedMustSee: string[] | undefined,
  t: (key: string, vars?: Record<string, string>) => string,
): string | undefined {
  if (!suggestedMustSee?.length) return undefined;
  return formatMustSeeList(suggestedMustSee, t);
}

/** User-visible answer text for assistant thread bubbles. */
export function displayIntakeAnswer(
  step: IntakeStepId,
  raw: string | undefined,
  t: (key: string) => string,
  suggestedMustSee?: string[],
): string {
  if (raw === undefined) return "";
  if (step === "b") {
    const resolved = resolveIntakeAnswer("b", raw, t);
    return resolved || t("play.plan.constraint_no_hotel");
  }
  if (step === "g" && !raw.trim()) {
    return t("play.plan.constraint_must_see_default");
  }
  if (step === "h" && !raw.trim()) return t("play.plan.constraint_none");
  return resolveIntakeAnswer(step, raw, t) || t(INTAKE_DEFAULT_I18N[step]);
}

export function intakeQaProgress(
  activeStep: IntakeStepId | null,
  intakeComplete: boolean,
): { current: number; total: number } {
  const total = 8;
  if (intakeComplete) return { current: total, total };
  if (activeStep) return { current: intakeStepIndex(activeStep) + 1, total };
  return { current: 1, total };
}
