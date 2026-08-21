import "server-only";
import { AGENT_ID } from "../core/locales";
import { isChinaMainland } from "../core/region";
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
  } catch {
    return { agent: AGENT_ID, ok: false, outcome: { key: "errors.provider_failed" } };
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
    },
  };
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

export function providersForPin(lat: number, lng: number): string[] {
  if (isChinaMainland(lat, lng)) {
    return ["AMAP", "GOOGLE_MAPS"];
  }
  return defaultProviders();
}

export { placesAgentBaseUrl, placesAgentCallerKey } from "./config";
