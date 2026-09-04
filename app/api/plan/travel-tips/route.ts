import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { ymdPlusDays } from "@/src/core/plan-agent-body";
import { iconicPlacesFromTravelTips } from "@/src/core/plan-iconic-parse";
import { artifactsTipsFromSlice, tripFetchSlice } from "@/src/core/plan-fetch-trip";
import { fetchTripDetails, travelTips, visaRequirement } from "@/src/places-agent/client";

function alpha3(raw: string | null | undefined): string | null {
  const v = raw?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(v) ? v : null;
}

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
  const tripType = typeof raw.tripType === "string" ? raw.tripType.trim() : undefined;
  const constraints = typeof raw.constraints === "string" ? raw.constraints.trim() : undefined;
  const paceRaw = raw.pace;
  const pace =
    paceRaw === "tight" || paceRaw === "medium" || paceRaw === "relaxed" ? paceRaw : undefined;
  const tripIdIn = typeof raw.trip_id === "string" ? raw.trip_id.trim() : "";
  const revisionIn = typeof raw.revision === "number" ? raw.revision : undefined;

  if (!destination || !startDate || !Number.isInteger(days) || days < 1 || days > 14) {
    return NextResponse.json({ error: { key: "errors.validation" } }, { status: 400 });
  }

  const locale = normalizeLocale(
    typeof raw.locale === "string" ? raw.locale : gate.user.locale,
  );
  const end = ymdPlusDays(startDate, Math.max(0, days - 1));

  try {
    const envelope = await travelTips({
      destination,
      bounds: { start: startDate, end },
      locale,
      ...(tripType ? { trip_type: tripType } : {}),
      ...(pace ? { pace } : {}),
      ...(constraints ? { constraints } : {}),
      ...(tripIdIn ? { trip_id: tripIdIn } : {}),
      ...(revisionIn ? { revision: revisionIn } : {}),
      ...(Array.isArray(raw.pool)
        ? { pool: raw.pool.filter((x: unknown) => typeof x === "string") }
        : {}),
    });

    if (!envelope.ok || !envelope.data) {
      return NextResponse.json(
        { ok: false, error: { key: envelope.outcome?.key ?? "play.plan.travel_tips_error" } },
        { status: 502 },
      );
    }

    const writeData = envelope.data as Record<string, unknown>;
    let tripId = typeof writeData.trip_id === "string" ? writeData.trip_id : tripIdIn || undefined;
    let revision = typeof writeData.revision === "number" ? writeData.revision : revisionIn;

    const passport = alpha3(gate.user.nationality);
    const destCountry = alpha3(typeof raw.destinationCountry === "string" ? raw.destinationCountry : undefined);
    if (passport && destCountry && tripId) {
      const visa = await visaRequirement({
        passport,
        destination: destCountry,
        trip_id: tripId,
        ...(typeof revision === "number" ? { revision } : {}),
        locale,
      });
      if (visa.ok && visa.data && typeof (visa.data as { revision?: number }).revision === "number") {
        revision = (visa.data as { revision: number }).revision;
      }
    }

    if (tripId) {
      const fetched = await fetchTripDetails({
        trip_id: tripId,
        fields: ["artifacts"],
        locale,
      });
      if (fetched.ok) {
        const { slice, revision: rev } = tripFetchSlice(fetched);
        if (typeof rev === "number") revision = rev;
        const tips = artifactsTipsFromSlice(slice) ?? slice;
        const artifacts = slice.artifacts as { visa?: { requirement?: string; description?: string } } | undefined;
        return NextResponse.json({
          ok: true,
          trip_id: tripId,
          revision,
          data: {
            intro: typeof tips.intro === "string" ? tips.intro : undefined,
            iconic_places: iconicPlacesFromTravelTips(tips),
            transit: typeof tips.transit === "string" ? tips.transit : undefined,
            weather: (tips.weather as { summary?: string } | null) ?? null,
            clothing: typeof tips.clothing === "string" ? tips.clothing : undefined,
            safety: typeof tips.safety === "string" ? tips.safety : undefined,
            visa_label: artifacts?.visa?.requirement,
            visa_detail: artifacts?.visa?.description,
          },
        });
      }
    }

    const d = writeData;
    const weather = d.weather as { summary?: string } | null | undefined;
    return NextResponse.json({
      ok: true,
      trip_id: tripId,
      revision,
      data: {
        intro: typeof d.intro === "string" ? d.intro : undefined,
        iconic_places: iconicPlacesFromTravelTips(d),
        transit: typeof d.transit === "string" ? d.transit : undefined,
        weather: weather ?? null,
        clothing: typeof d.clothing === "string" ? d.clothing : undefined,
        safety: typeof d.safety === "string" ? d.safety : undefined,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { key: "play.plan.travel_tips_error" } },
      { status: 502 },
    );
  }
}
