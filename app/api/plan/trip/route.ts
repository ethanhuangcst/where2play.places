import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { criteriaFromPlanTripBody, planTripBffBody, toAgentPlanTripBody } from "@/src/core/plan-trip-body";
import { emptyPlanItinerary, upsertPlanSessionCache } from "@/src/core/plan-session-cache";
import { tripFetchSlice } from "@/src/core/plan-fetch-trip";
import { fetchTripDetails, planTrip } from "@/src/places-agent/client";

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

  const data = envelope.data;
  const questions = data.need_input?.questions;
  // Empty need_input: 2play falls back to local intake steps (b–h). Not a 502.
  // T3 skeleton_only: strip classic intake needs, but pass through expand_radius (104).
  const expandRadiusQuestions = Array.isArray(questions)
    ? questions.filter((q) => q.id === "expand_radius")
    : [];
  const needInput =
    parsed.data.skeleton_only === true
      ? data.status === "needs_input" && expandRadiusQuestions.length > 0
        ? { questions: expandRadiusQuestions }
        : undefined
      : data.status === "needs_input" && Array.isArray(questions) && questions.length > 0
        ? data.need_input
        : data.status === "needs_input"
          ? { questions: [] }
          : data.need_input;

  const criteria = criteriaFromPlanTripBody(parsed.data, {
    trip_id: data.trip_id,
    revision: data.revision,
  });
  await upsertPlanSessionCache(gate.user.id, criteria, emptyPlanItinerary(criteria));

  let skeleton: unknown = data.itinerary?.skeleton;
  let constraints: unknown;
  if (
    parsed.data.skeleton_only === true &&
    data.status === "ready" &&
    data.trip_id
  ) {
    const fetched = await fetchTripDetails({
      trip_id: data.trip_id,
      fields: ["skeleton", "constraints"],
      locale,
    });
    if (fetched.ok && fetched.data) {
      const slice = tripFetchSlice(fetched);
      if (slice.slice.skeleton) skeleton = slice.slice.skeleton;
      if (slice.slice.constraints) constraints = slice.slice.constraints;
      if (typeof slice.revision === "number") {
        criteria.revision = slice.revision;
      }
    }
  }

  if (parsed.data.skeleton_only === true && data.status === "failed") {
    return NextResponse.json(
      {
        ok: false,
        error: { key: "errors.provider_failed" },
        trip_id: data.trip_id,
        revision: data.revision,
        status: data.status,
        phases: data.phases,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    trip_id: data.trip_id,
    revision: typeof criteria.revision === "number" ? criteria.revision : data.revision,
    status: data.status,
    need_input: needInput,
    phases: data.phases,
    ...(skeleton ? { skeleton } : {}),
    ...(constraints ? { constraints } : {}),
  });
}
