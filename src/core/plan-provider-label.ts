export function planProviderKey(
  provider: string | undefined | null,
): "play.plan.provider.google" | "play.plan.provider.amap" | "play.plan.provider.none" {
  const p = (provider ?? "").toUpperCase().replace(/[\s-]/g, "_");
  if (p === "GOOGLE_MAPS" || p === "GOOGLE" || p === "GMAP" || p === "GMAPS") {
    return "play.plan.provider.google";
  }
  if (p === "AMAP" || p === "GAODE") return "play.plan.provider.amap";
  return "play.plan.provider.none";
}
