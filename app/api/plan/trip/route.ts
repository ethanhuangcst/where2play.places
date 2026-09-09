import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { criteriaFromPlanTripBody, planTripBffBody, toAgentPlanTripBody } from "@/src/core/plan-trip-body";
import { emptyPlanItinerary, upsertPlanSessionCache } from "@/src/core/plan-session-cache";
import { planTrip } from "@/src/places-agent/client";

export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const raw = await request.json().catch(() => ({}));
  const days =
    typeof raw.days === "string" && raw.days.trim() ? Number(raw.days) : raw.days;
  const partySize =
    typeof raw.partySize === "string" && raw.partySize.trim()
      ? Number(raw.partySize)
      : raw.partySize;
  const parsed = planTripBffBody.safeParse({
    ...raw,
    days,
    partySize,
    locale: typeof raw.locale === "string" ? raw.locale : gate.user.locale,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(parsed.data.locale ?? gate.user.locale);
  const agentBody = toAgentPlanTripBody({ ...parsed.data, locale });
  if ("providers" in agentBody) {
    delete agentBody.providers;
  }

  const envelope = await planTrip(agentBody);
  if (!envelope.ok || !envelope.data) {
    const key = envelope.outcome?.key ?? "errors.provider_failed";
    const status = key.includes("timeout") ? 504 : 502;
    return NextResponse.json({ ok: false, error: { key } }, { status });
  }

  const questions = envelope.data.need_input?.questions;
  // Empty need_input: 2play falls back to local intake steps (b–h). Not a 502.
  const needInput =
    envelope.data.status === "needs_input" && Array.isArray(questions) && questions.length > 0
      ? envelope.data.need_input
      : envelope.data.status === "needs_input"
        ? { questions: [] }
        : envelope.data.need_input;

  const criteria = criteriaFromPlanTripBody(parsed.data, {
    trip_id: envelope.data.trip_id,
    revision: envelope.data.revision,
  });
  await upsertPlanSessionCache(gate.user.id, criteria, emptyPlanItinerary(criteria));

  return NextResponse.json({
    ok: true,
    trip_id: envelope.data.trip_id,
    revision: envelope.data.revision,
    status: envelope.data.status,
    need_input: needInput,
  });
}
