import type { PlanBoundaries } from "./itinerary-types";

export type PlanFieldErrors = Partial<
  Record<"destination" | "days" | "startDate" | "timeFrom" | "timeTo", string>
>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidYmd(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function validatePlanBoundaries(input: unknown): {
  ok: true;
  value: PlanBoundaries;
} | {
  ok: false;
  errors: PlanFieldErrors;
} {
  const body = (input ?? {}) as Record<string, unknown>;
  const errors: PlanFieldErrors = {};

  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) errors.destination = "play.plan.error.destination_required";

  const daysRaw = body.days;
  const days =
    typeof daysRaw === "number"
      ? daysRaw
      : typeof daysRaw === "string" && daysRaw.trim()
        ? Number(daysRaw)
        : NaN;
  if (!Number.isInteger(days) || days < 1 || days > 14) {
    errors.days = "play.plan.error.days_range";
  }

  const startDateRaw = typeof body.startDate === "string" ? body.startDate.trim() : "";
  if (!startDateRaw || !isValidYmd(startDateRaw)) {
    errors.startDate = "play.plan.error.start_date_required";
  }

  const timeFromRaw = typeof body.timeFrom === "string" ? body.timeFrom.trim() : "";
  const timeToRaw = typeof body.timeTo === "string" ? body.timeTo.trim() : "";
  // plan-14: normalize H:MM → HH:MM before comparing; naive string compare
  // misjudges "9:00" vs "10:00".
  const normalizeTime = (t: string): string => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!m) return t;
    return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
  };
  const timeFrom = timeFromRaw ? normalizeTime(timeFromRaw) : "";
  const timeTo = timeToRaw ? normalizeTime(timeToRaw) : "";
  if (timeFrom && timeTo && timeTo <= timeFrom) {
    errors.timeTo = "play.plan.error.time_order";
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const optionalString = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const partySize =
    typeof body.partySize === "number"
      ? body.partySize
      : typeof body.partySize === "string" && body.partySize.trim()
        ? Number(body.partySize)
        : undefined;

  const interests = Array.isArray(body.interests)
    ? body.interests.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : undefined;

  return {
    ok: true,
    value: {
      destination,
      days,
      startDate: startDateRaw,
      ...(partySize != null && Number.isFinite(partySize) ? { partySize } : {}),
      ...(optionalString(body.tripType) ? { tripType: optionalString(body.tripType) } : {}),
      ...(optionalString(body.budget) ? { budget: optionalString(body.budget) } : {}),
      ...(optionalString(body.pace) ? { pace: optionalString(body.pace) } : {}),
      ...(optionalString(body.transport) ? { transport: optionalString(body.transport) } : {}),
      ...(optionalString(body.dailyStart) ? { dailyStart: optionalString(body.dailyStart) } : {}),
      ...(optionalString(body.dailyEnd) ? { dailyEnd: optionalString(body.dailyEnd) } : {}),
      ...(timeFrom ? { timeFrom } : {}),
      ...(timeTo ? { timeTo } : {}),
      ...(interests?.length ? { interests } : {}),
      ...(optionalString(body.constraints)
        ? { constraints: optionalString(body.constraints)!.slice(0, 500) }
        : {}),
      ...(optionalString(body.locale) ? { locale: optionalString(body.locale) } : {}),
    },
  };
}
