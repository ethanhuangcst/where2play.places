import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { fetchIconicPlacesForPlan } from "@/src/core/plan-iconic";
import { normalizeLocale } from "@/src/core/locales";
import { providersForDestinationText } from "@/src/places-agent/client";

export async function POST(request: NextRequest) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const raw = await request.json().catch(() => ({}));
  const destination = typeof raw.destination === "string" ? raw.destination.trim() : "";
  const startDate = typeof raw.startDate === "string" ? raw.startDate.trim() : "";
  const daysRaw = raw.days;
  const days =
    typeof daysRaw === "number"
      ? daysRaw
      : typeof daysRaw === "string" && daysRaw.trim()
        ? Number(daysRaw)
        : NaN;

  if (!destination || !startDate || !Number.isInteger(days) || days < 1 || days > 14) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(
    typeof raw.locale === "string" ? raw.locale : gate.user.locale,
  );

  const suggestions = await fetchIconicPlacesForPlan({
    destination,
    startDate,
    days,
    locale,
    providers: providersForDestinationText(destination),
  });

  return NextResponse.json({ ok: true, suggestions });
}
