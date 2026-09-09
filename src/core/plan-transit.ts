/** Takeoff transit preference — two modes only (public+walk vs drive/taxi+walk). */
export const TRANSIT_OPTION_KEYS = ["transit_walk", "drive_walk"] as const;
export type TransitOptionKey = (typeof TRANSIT_OPTION_KEYS)[number];

const TRANSIT_OPTION_I18N: Record<TransitOptionKey, string> = {
  transit_walk: "play.plan.transit.transit_walk",
  drive_walk: "play.plan.transit.drive_walk",
};

/** Phrases sent to the agent (not UI labels). */
export const TRANSIT_AGENT_PHRASE: Record<TransitOptionKey, string> = {
  transit_walk: "公共交通+步行",
  drive_walk: "自驾/打车+步行",
};

export function transitOptionLabel(key: TransitOptionKey, t: (k: string) => string): string {
  return t(TRANSIT_OPTION_I18N[key]);
}

export function normalizeTransitKey(raw: string | undefined): TransitOptionKey | "" {
  const v = raw?.trim() ?? "";
  if (!v) return "";
  if (TRANSIT_OPTION_KEYS.includes(v as TransitOptionKey)) return v as TransitOptionKey;
  const lower = v.toLowerCase();
  if (/公交|地铁|metro|public|transit_walk/.test(lower)) return "transit_walk";
  if (/自驾|打车|drive|taxi|drive_walk/.test(lower)) return "drive_walk";
  if (v === "public" || v === "walk" || v === "mixed") return "transit_walk";
  if (v === "drive") return "drive_walk";
  return "";
}

export function transitKeyForAgent(key: TransitOptionKey | ""): string | undefined {
  if (!key) return undefined;
  return TRANSIT_AGENT_PHRASE[key];
}
