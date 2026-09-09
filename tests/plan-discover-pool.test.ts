import { describe, expect, it } from "vitest";
import { discoverPoolRowsFromSlice } from "../src/core/plan-discover-pool";
import { planProviderKey } from "../src/core/plan-provider-label";

describe("discover pool provider", () => {
  it("should_keep_provider_on_pool_rows", () => {
    const rows = discoverPoolRowsFromSlice({
      places: [{ name: "Torre de Belém", provider: "GOOGLE_MAPS", must_see: true }],
      restaurants: [{ name: "A meal", provider: "AMAP" }],
    });
    expect(rows[0]?.provider).toBe("GOOGLE_MAPS");
    expect(rows[1]?.provider).toBe("AMAP");
  });

  it("should_read_provider_from_sources_when_top_level_missing", () => {
    const rows = discoverPoolRowsFromSlice({
      places: [{ name: "Torre", sources: [{ provider: "GMAP" }] }],
      restaurants: [{ name: "Meal", sources: [{ provider: "GAODE" }] }],
    });
    expect(rows[0]?.provider).toBe("GMAP");
    expect(rows[1]?.provider).toBe("GAODE");
  });

  it("should_map_provider_keys", () => {
    expect(planProviderKey("GOOGLE_MAPS")).toBe("play.plan.provider.google");
    expect(planProviderKey("AMAP")).toBe("play.plan.provider.amap");
    expect(planProviderKey("GMAP")).toBe("play.plan.provider.google");
    expect(planProviderKey("GAODE")).toBe("play.plan.provider.amap");
    expect(planProviderKey(undefined)).toBe("play.plan.provider.none");
  });
});
