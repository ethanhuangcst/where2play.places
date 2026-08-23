import type { PlanBoundaries } from "./itinerary-types";
import { enrichArrangeTransit, geocode as agentGeocode } from "../places-agent/client";
import type { AgentEnvelope, GeocodeResult } from "../places-agent/client";
import type { ArrangeDayLlmResult, ScheduleCandidatePools } from "./plan-arrange-llm";

let enrichOverride:
  | ((body: Record<string, unknown>) => Promise<ArrangeDayLlmResult>)
  | null = null;

export function setEnrichArrangeTransitForTests(
  fn: ((body: Record<string, unknown>) => Promise<ArrangeDayLlmResult>) | null,
): void {
  enrichOverride = fn;
}

let geocodeOverride:
  | ((input: { query: string; locale: string; providers?: string[] }) => Promise<AgentEnvelope<GeocodeResult>>)
  | null = null;

export function setGeocodeForTests(
  fn: ((input: { query: string; locale: string; providers?: string[] }) => Promise<AgentEnvelope<GeocodeResult>>) | null,
): void {
  geocodeOverride = fn;
}

const geocodeCache = new Map<string, AgentEnvelope<GeocodeResult>>();

export function resetGeocodeCache(): void {
  geocodeCache.clear();
}

async function resolvePoint(
  name: string,
  locale: string,
  providers: string[],
): Promise<AgentEnvelope<GeocodeResult>> {
  if (geocodeCache.has(name)) return geocodeCache.get(name)!;
  const fn = geocodeOverride ?? agentGeocode;
  const result = await fn({ query: name, locale, providers });
  geocodeCache.set(name, result);
  return result;
}

export async function enrichArrangedDay(input: {
  arranged: ArrangeDayLlmResult;
  criteria: PlanBoundaries;
  providers: string[];
  locale: string;
  candidates: ScheduleCandidatePools;
}): Promise<ArrangeDayLlmResult> {
  const originName = input.criteria.dailyStart
    ? input.criteria.dailyStart
    : input.criteria.destination;
  const destinationName = input.criteria.dailyEnd
    ? input.criteria.dailyEnd
    : input.criteria.destination;

  const originEnvelope = await resolvePoint(originName, input.locale, input.providers);
  const destinationEnvelope = await resolvePoint(destinationName, input.locale, input.providers);

  const origin: Record<string, unknown> = { name: originName };
  if (originEnvelope.ok && originEnvelope.data) {
    origin.lat = originEnvelope.data.lat;
    origin.lng = originEnvelope.data.lng;
    origin.crs = originEnvelope.data.crs;
  }

  const destination: Record<string, unknown> = { name: destinationName };
  if (destinationEnvelope.ok && destinationEnvelope.data) {
    destination.lat = destinationEnvelope.data.lat;
    destination.lng = destinationEnvelope.data.lng;
    destination.crs = destinationEnvelope.data.crs;
  }

  const preferences: Record<string, unknown> = {};
  if (input.criteria.transport) {
    if (/步行优先|walk/i.test(input.criteria.transport)) {
      preferences.transit_preferred = false;
    } else if (/捷运|metro|transit|公交|bus/i.test(input.criteria.transport)) {
      preferences.transit_preferred = true;
    }
  }

  const body: Record<string, unknown> = {
    day: {
      day_index: input.arranged.day_index,
      date: input.arranged.date,
      theme: input.arranged.theme,
      blocks: input.arranged.blocks,
    },
    candidates: input.candidates,
    origin,
    destination,
    locale: input.locale,
    providers: input.providers,
    ...(Object.keys(preferences).length ? { preferences } : {}),
  };

  if (enrichOverride) {
    const overridden = await enrichOverride(body);
    return applyGeocodeOutcome(overridden, originEnvelope, destinationEnvelope);
  }

  const envelope = await enrichArrangeTransit(body);
  if (!envelope.ok || !envelope.data) {
    return {
      ...input.arranged,
      transit_outcome: "partial",
    };
  }

  const data = envelope.data as {
    blocks?: ArrangeDayLlmResult["blocks"];
    from_origin?: ArrangeDayLlmResult["from_origin"];
    to_destination?: ArrangeDayLlmResult["to_destination"];
    transit_outcome?: ArrangeDayLlmResult["transit_outcome"];
    theme?: string;
  };

  const raw: ArrangeDayLlmResult = {
    ...input.arranged,
    ...(data.theme ? { theme: data.theme } : {}),
    blocks: data.blocks ?? input.arranged.blocks,
    from_origin: data.from_origin,
    to_destination: data.to_destination,
    transit_outcome: data.transit_outcome ?? "directions",
  };

  return applyGeocodeOutcome(raw, originEnvelope, destinationEnvelope);
}

function applyGeocodeOutcome(
  raw: ArrangeDayLlmResult,
  originEnvelope: AgentEnvelope<GeocodeResult>,
  destinationEnvelope: AgentEnvelope<GeocodeResult>,
): ArrangeDayLlmResult {
  const geocodeFailed = !originEnvelope.ok || !destinationEnvelope.ok;
  if (!geocodeFailed) return raw;
  return {
    ...raw,
    from_origin: originEnvelope.ok ? raw.from_origin : undefined,
    to_destination: destinationEnvelope.ok ? raw.to_destination : undefined,
    transit_outcome: "partial",
  };
}
