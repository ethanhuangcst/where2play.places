import "server-only";

export type PlacesAgentTarget = "local" | "prod";

/** Which places-agent stack the BFF calls (HTTP /v1/*). */
export function placesAgentTarget(): PlacesAgentTarget {
  const raw = (process.env.PLACES_AGENT_TARGET ?? "local").trim().toLowerCase();
  if (raw === "prod" || raw === "production") return "prod";
  return "local";
}

function trimUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function placesAgentBaseUrl(): string {
  const target = placesAgentTarget();
  const perTarget =
    target === "prod"
      ? process.env.PLACES_AGENT_BASE_URL_PROD
      : process.env.PLACES_AGENT_BASE_URL_LOCAL;
  if (perTarget?.trim()) return trimUrl(perTarget);

  const legacy = process.env.PLACES_AGENT_BASE_URL;
  if (legacy?.trim()) return trimUrl(legacy);

  const hint =
    target === "prod"
      ? "PLACES_AGENT_BASE_URL_PROD=https://places.agent-mate.ai"
      : "PLACES_AGENT_BASE_URL_LOCAL=http://localhost:3010";
  throw new Error(`Missing places-agent URL for target "${target}". Set ${hint} or PLACES_AGENT_BASE_URL.`);
}

export function placesAgentCallerKey(): string {
  const target = placesAgentTarget();
  const perTarget =
    target === "prod"
      ? process.env.PLACES_AGENT_CALLER_KEY_PROD
      : process.env.PLACES_AGENT_CALLER_KEY_LOCAL;
  if (perTarget?.trim()) return perTarget.trim();

  const legacy = process.env.PLACES_AGENT_CALLER_KEY;
  if (legacy?.trim()) return legacy.trim();

  const hint =
    target === "prod" ? "PLACES_AGENT_CALLER_KEY_PROD" : "PLACES_AGENT_CALLER_KEY_LOCAL";
  throw new Error(`Missing caller key for target "${target}". Set ${hint} or PLACES_AGENT_CALLER_KEY.`);
}
