import "server-only";
import { AGENT_ID } from "../core/locales";
import { placesAgentBaseUrl, placesAgentCallerKey } from "./config";

export type AgentEnvelope<T = unknown> = {
  agent: string;
  ok: boolean;
  data?: T;
  outcome?: { key: string; locales?: Record<string, string> };
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  crs: string;
  label?: string;
  country?: string;
  country_code?: string;
  city?: string;
  city_en?: string;
};

export type FetchFn = typeof fetch;

const DEFAULT_TIMEOUT_MS = 25_000;

function timeoutMs(): number {
  const raw = Number(process.env.PLACES_AGENT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

let injectedFetch: FetchFn | null = null;

export function setPlacesAgentFetchForTests(fn: FetchFn | null): void {
  injectedFetch = fn;
}

async function postV1<T>(
  tool: string,
  body: unknown,
  fetchFn: FetchFn = injectedFetch ?? fetch,
  requestTimeoutMs: number = timeoutMs(),
): Promise<AgentEnvelope<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const res = await fetchFn(`${placesAgentBaseUrl()}/v1/${tool}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${placesAgentCallerKey()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let envelope: AgentEnvelope<T>;
    try {
      envelope = (text ? JSON.parse(text) : { agent: AGENT_ID, ok: false }) as AgentEnvelope<T>;
    } catch {
      return { agent: AGENT_ID, ok: false, outcome: { key: "errors.provider_failed" } };
    }
    if (envelope.agent !== AGENT_ID) {
      return { agent: AGENT_ID, ok: false, outcome: { key: "errors.provider_failed" } };
    }
    return envelope;
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === "AbortError") || controller.signal.aborted;
    const key = aborted
      ? tool === "arrange_day"
        ? "errors.arrange_timeout"
        : tool === "make_itinerary"
          ? "play.plan.phase_make_timeout"
          : "errors.provider_failed"
      : "errors.provider_failed";
    return { agent: AGENT_ID, ok: false, outcome: { key } };
  } finally {
    clearTimeout(timer);
  }
}

type AgentGeocodeData = {
  lat: number;
  lng: number;
  crs: string;
  address?: string;
  label?: string;
  country?: string;
  country_code?: string;
  city?: string;
  city_en?: string;
};

export async function reverseGeocode(input: {
  lat: number;
  lng: number;
  locale: string;
  providers?: string[];
}): Promise<AgentEnvelope<GeocodeResult>> {
  const envelope = await postV1<AgentGeocodeData>("geocode", {
    lat: input.lat,
    lng: input.lng,
    locale: input.locale,
    providers: input.providers,
  });
  if (!envelope.data) return envelope as AgentEnvelope<GeocodeResult>;
  const label = envelope.data.label ?? envelope.data.address;
  return {
    ...envelope,
    data: {
      lat: envelope.data.lat,
      lng: envelope.data.lng,
      crs: envelope.data.crs,
      label,
      ...(envelope.data.country ? { country: envelope.data.country } : {}),
      ...(envelope.data.country_code ? { country_code: envelope.data.country_code } : {}),
      ...(envelope.data.city ? { city: envelope.data.city } : {}),
      ...(envelope.data.city_en ? { city_en: envelope.data.city_en } : {}),
    },
  };
}

/** Forward geocode: resolve a place name to coordinates via agent `/v1/geocode`. */
export async function geocode(input: {
  query: string;
  locale: string;
  providers?: string[];
}): Promise<AgentEnvelope<GeocodeResult>> {
  const envelope = await postV1<AgentGeocodeData>("geocode", {
    query: input.query,
    locale: input.locale,
    providers: input.providers,
  });
  if (!envelope.data) return envelope as AgentEnvelope<GeocodeResult>;
  const label = envelope.data.label ?? envelope.data.address;
  return {
    ...envelope,
    data: {
      lat: envelope.data.lat,
      lng: envelope.data.lng,
      crs: envelope.data.crs,
      label,
      ...(envelope.data.country ? { country: envelope.data.country } : {}),
      ...(envelope.data.country_code ? { country_code: envelope.data.country_code } : {}),
      ...(envelope.data.city ? { city: envelope.data.city } : {}),
      ...(envelope.data.city_en ? { city_en: envelope.data.city_en } : {}),
    },
  };
}

export async function searchPlaces(input: {
  query: string;
  address?: string;
  near?: { lat: number; lng: number; crs?: string };
  locale: string;
  providers?: string[];
  bias_radius_m?: number;
}): Promise<AgentEnvelope<Array<{ name: string; location?: { lat?: number; lng?: number } }>>> {
  return postV1("search_places", {
    query: input.query,
    address: input.address,
    near: input.near,
    locale: input.locale,
    providers: input.providers,
    bias_radius_m: input.bias_radius_m,
  });
}

export async function suggestPlaces(input: {
  query: string;
  address?: string;
  near?: { lat: number; lng: number; crs?: string };
  locale: string;
  providers?: string[];
  bias_radius_m?: number;
}): Promise<AgentEnvelope<Array<{ name: string; location?: { lat?: number; lng?: number }; address?: string }>>> {
  return postV1("suggest_places", {
    query: input.query,
    address: input.address,
    near: input.near,
    locale: input.locale,
    providers: input.providers,
    bias_radius_m: input.bias_radius_m,
  });
}

export function defaultProviders(): string[] {
  try {
    const raw = process.env.W2P_DEFAULT_PROVIDERS ?? '["GOOGLE_MAPS"]';
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return ["GOOGLE_MAPS"];
}

export function providersForPin(_lat: number, _lng: number): string[] | undefined {
  // ADR-052: omit providers[] — places-agent resolves by region.
  return undefined;
}

/** @deprecated ADR-052 — never assemble CJK dual-source lists; always omit. */
export function providersForDestinationText(_destination: string): string[] | undefined {
  return undefined;
}

const DEFAULT_PLAN_TIMEOUT_MS = 120_000;

function planTimeoutMs(): number {
  const raw = Number(process.env.PLACES_AGENT_PLAN_TIMEOUT_MS ?? DEFAULT_PLAN_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PLAN_TIMEOUT_MS;
}

export type AgentTimedPlanData = Record<string, unknown>;

export async function planItinerary(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<AgentTimedPlanData>> {
  return postV1<AgentTimedPlanData>("plan_itinerary", body, injectedFetch ?? fetch, planTimeoutMs());
}

const DEFAULT_DISCOVER_TIMEOUT_MS = 60_000;
/** Covers one hard LLM attempt + one validation retry + buffer (agent 45s × 2). */
const DEFAULT_ARRANGE_TIMEOUT_MS = 110_000;

function discoverTimeoutMs(): number {
  const raw = Number(process.env.PLACES_AGENT_DISCOVER_TIMEOUT_MS ?? DEFAULT_DISCOVER_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DISCOVER_TIMEOUT_MS;
}

function arrangeTimeoutMs(): number {
  const raw = Number(process.env.PLACES_AGENT_ARRANGE_TIMEOUT_MS ?? DEFAULT_ARRANGE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ARRANGE_TIMEOUT_MS;
}

export type DiscoverPlacesData = {
  candidates?: { places?: unknown[]; restaurants?: unknown[] };
  weather?: unknown;
  trip_id?: string;
  revision?: number;
};

export type ArrangeDayData = Record<string, unknown>;

/** ADR-032: search candidates (~5–20s). */
export async function discoverPlaces(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<DiscoverPlacesData>> {
  return postV1<DiscoverPlacesData>(
    "discover_places",
    body,
    injectedFetch ?? fetch,
    discoverTimeoutMs(),
  );
}

/** @deprecated Mode H — use planNextStop + makeItinerary skeleton pipeline instead. */
export async function arrangeDay(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<ArrangeDayData>> {
  return postV1<ArrangeDayData>("arrange_day", body, injectedFetch ?? fetch, arrangeTimeoutMs());
}

export type EnrichArrangeTransitData = Record<string, unknown>;

/** @deprecated Mode H — use planNextStop skeleton fill instead. */
export async function enrichArrangeTransit(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<EnrichArrangeTransitData>> {
  return postV1<EnrichArrangeTransitData>(
    "enrich_arrange_transit",
    body,
    injectedFetch ?? fetch,
    arrangeTimeoutMs(),
  );
}

const DEFAULT_MAKE_ITINERARY_TIMEOUT_MS = 170_000;

function makeItineraryTimeoutMs(): number {
  const raw = Number(process.env.PLACES_AGENT_MAKE_ITINERARY_TIMEOUT_MS ?? DEFAULT_MAKE_ITINERARY_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAKE_ITINERARY_TIMEOUT_MS;
}

export type MakeItineraryData = {
  skeleton?: { days?: unknown[] };
  trip_id?: string;
  revision?: number;
  candidates_slim?: { places?: unknown[]; restaurants?: unknown[] };
};

export async function makeItinerary(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<MakeItineraryData>> {
  return postV1<MakeItineraryData>(
    "make_itinerary",
    body,
    injectedFetch ?? fetch,
    makeItineraryTimeoutMs(),
  );
}

export type PlanNextStopData = Record<string, unknown>;

export async function planNextStop(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<PlanNextStopData>> {
  return postV1<PlanNextStopData>("plan_next_stop", body, injectedFetch ?? fetch, planTimeoutMs());
}

export type FetchTripDetailsData = Record<string, unknown>;

export async function patchTrip(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<{ trip_id?: string; revision?: number }>> {
  return postV1("patch_trip", body, injectedFetch ?? fetch, planTimeoutMs());
}

export type PlanTripData = {
  trip_id: string;
  revision: number;
  status: "needs_input" | "planning" | "ready" | "failed";
  need_input?: {
    questions: Array<{
      id: string;
      prompt: string;
      options?: Array<{ id: string; label: string }>;
      multi?: boolean;
    }>;
  };
  /** T3 phase stream (skeleton_generating / skeleton_ready / …). */
  phases?: Array<{
    phase: string;
    trip_id?: string;
    revision?: number;
    error?: { key?: string };
  }>;
  /** Full-loop / skeleton payload when status is ready. */
  itinerary?: {
    skeleton: unknown;
    filledStops: unknown[];
    artifacts?: Record<string, unknown>;
  };
};

export async function planTrip(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<PlanTripData>> {
  return postV1<PlanTripData>("plan_trip", body, injectedFetch ?? fetch, planTimeoutMs());
}

export type ListDestinationPoisData = {
  count: number;
  places: Array<{ name: string; kind?: string; provider?: string }>;
};

export async function listDestinationPois(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<ListDestinationPoisData>> {
  return postV1<ListDestinationPoisData>(
    "list_destination_pois",
    body,
    injectedFetch ?? fetch,
    timeoutMs(),
  );
}

export async function fetchTripDetails(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<FetchTripDetailsData>> {
  return postV1<FetchTripDetailsData>("fetch_trip_details", body, injectedFetch ?? fetch, planTimeoutMs());
}

export type PlaceDetailsData = Record<string, unknown>;

export async function getPlaceDetails(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<PlaceDetailsData>> {
  return postV1<PlaceDetailsData>("get_place_details", body, injectedFetch ?? fetch, timeoutMs());
}

export type TravelTipsData = Record<string, unknown>;

export async function travelTips(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<TravelTipsData>> {
  return postV1<TravelTipsData>("travel_tips", body, injectedFetch ?? fetch, planTimeoutMs());
}

export async function visaRequirement(
  body: Record<string, unknown>,
): Promise<AgentEnvelope<Record<string, unknown>>> {
  return postV1("visa_requirement", body, injectedFetch ?? fetch, timeoutMs());
}

export type AgentNdjsonEvent = Record<string, unknown> & { type: string };

/**
 * Prefer agent NDJSON progressive events; fall back to a single batch envelope
 * yielded as `{ type: "batch", envelope }`.
 */
export async function* streamV1Ndjson(
  tool: "discover_places" | "arrange_day",
  body: Record<string, unknown>,
  requestTimeoutMs: number = tool === "discover_places" ? discoverTimeoutMs() : arrangeTimeoutMs(),
): AsyncGenerator<AgentNdjsonEvent> {
  const fetchFn = injectedFetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const res = await fetchFn(`${placesAgentBaseUrl()}/v1/${tool}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
        Authorization: `Bearer ${placesAgentCallerKey()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("application/x-ndjson") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as AgentNdjsonEvent;
            if (obj && typeof obj.type === "string") yield obj;
          } catch {
            /* skip bad line */
          }
        }
      }
      const last = buf.trim();
      if (last) {
        try {
          const obj = JSON.parse(last) as AgentNdjsonEvent;
          if (obj && typeof obj.type === "string") yield obj;
        } catch {
          /* skip */
        }
      }
      return;
    }
    const text = await res.text();
    let envelope: AgentEnvelope<unknown>;
    try {
      envelope = (text ? JSON.parse(text) : { agent: AGENT_ID, ok: false }) as AgentEnvelope<unknown>;
    } catch {
      yield { type: "error", key: "errors.provider_failed" };
      return;
    }
    yield { type: "batch", envelope };
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === "AbortError") || controller.signal.aborted;
    const key =
      aborted && tool === "arrange_day" ? "errors.arrange_timeout" : "errors.provider_failed";
    yield { type: "error", key };
  } finally {
    clearTimeout(timer);
  }
}

export { placesAgentBaseUrl, placesAgentCallerKey } from "./config";
