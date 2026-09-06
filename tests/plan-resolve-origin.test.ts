import { describe, expect, it, vi } from "vitest";
import {
  ORIGIN_NEAR_CITY_KM,
  originNameFromPick,
  pickOriginCardNearCity,
  resolvePlanOrigin,
  resolveOriginPick,
  sanitizeDailyStartName,
} from "../src/core/plan-resolve-origin";

const LISBON = { lat: 38.7223, lng: -9.1393 };
const MACAU = { lat: 22.186785, lng: 113.549525 };
const HANGZHOU = { lat: 30.2547, lng: 120.1618 };

describe("pickOriginCardNearCity (TC-M21-41-21)", () => {
  it("should_skip_empty_via_resolvePlanOrigin_with_city_coords (S7)", async () => {
    const r = await resolvePlanOrigin(
      { query: "  ", destination: "里斯本", locale: "CN" },
      {
        searchPlaces: async () => ({ ok: true, data: [] }),
        geocode: async () => ({ ok: true, data: LISBON }),
      },
    );
    expect(r).toEqual({ kind: "skip", lat: LISBON.lat, lng: LISBON.lng });
  });

  it("should_keep_lisbon_hotel_and_drop_macau_coords", () => {
    const hit = pickOriginCardNearCity(
      [
        { name: "Hills Hotel Lisboa", location: { lat: 38.73, lng: -9.14 } },
        { name: "Hotel Lisboa", location: MACAU },
      ],
      LISBON,
      ORIGIN_NEAR_CITY_KM,
    );
    expect(hit?.name).toBe("Hills Hotel Lisboa");
  });

  it("should_return_not_found_when_only_far_cards", async () => {
    const r = await resolvePlanOrigin(
      { query: "Hills Hotel Lisboa", destination: "里斯本", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: LISBON }),
        searchPlaces: async () => ({
          ok: true,
          data: [{ name: "Hotel Lisboa", location: MACAU }],
        }),
      },
    );
    expect(r.kind).toBe("not_found");
  });

  it("should_hit_when_search_returns_name_matching_lisbon_card (S7)", async () => {
    const searchPlaces = vi.fn(async () => ({
      ok: true as const,
      data: [{ name: "Hills Hotel Lisboa", location: { lat: 38.73, lng: -9.14 } }],
    }));
    const geocode = vi.fn(async (input: { query: string }) => {
      expect(input.query).toBe("里斯本");
      return { ok: true as const, data: LISBON };
    });
    const r = await resolvePlanOrigin(
      { query: "Hills Hotel Lisboa", destination: "里斯本", locale: "CN" },
      { searchPlaces, geocode, providersForPin: () => ["GOOGLE_MAPS"] },
    );
    expect(r).toEqual({
      kind: "hit",
      name: "Hills Hotel Lisboa",
      lat: 38.73,
      lng: -9.14,
    });
    expect(searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Hills Hotel Lisboa",
        near: LISBON,
        address: "里斯本",
        bias_radius_m: 50_000,
        providers: ["GOOGLE_MAPS"],
      }),
    );
  });

  it("should_hit_with_provider_native_id_and_strip_parens_query (ADR-053)", async () => {
    const searchPlaces = vi.fn(async (input: { query: string }) => {
      expect(input.query).not.toMatch(/钟楼|回民街/);
      expect(input.query).toContain("凯悦逸扉酒店");
      return {
        ok: true as const,
        data: [
          {
            name: "凯悦逸扉酒店(西安钟楼回民街店)",
            location: { lat: 34.26, lng: 108.94 },
            provider: "AMAP",
            category: "酒店",
            sources: [{ provider: "AMAP", native_id: "B000A87B" }],
            photos: ["https://store.is.autonavi.com/photo.jpg"],
          },
          {
            name: "西安钟楼",
            location: { lat: 34.261, lng: 108.942 },
            provider: "AMAP",
            category: "风景名胜",
            sources: [{ provider: "AMAP", native_id: "B000TOWER" }],
          },
        ],
      };
    });
    const r = await resolvePlanOrigin(
      { query: "凯悦逸扉酒店(西安钟楼回民街店)", destination: "西安", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: { lat: 34.26, lng: 108.94 } }),
        searchPlaces,
      },
    );
    expect(r.kind).toBe("hit");
    if (r.kind === "hit") {
      expect(r.name).toContain("凯悦逸扉");
      expect(r.provider).toBe("AMAP");
      expect(r.native_id).toBe("B000A87B");
      expect(r.photos?.[0]).toMatch(/^https:/);
      expect(r.name).not.toBe("西安钟楼");
    }
  });

  it("should_not_auto_hit_landmark_when_only_bell_tower_near_city (ADR-053)", async () => {
    const r = await resolvePlanOrigin(
      { query: "凯悦逸扉酒店(西安钟楼回民街店)", destination: "西安", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: { lat: 34.26, lng: 108.94 } }),
        searchPlaces: async () => ({
          ok: true,
          data: [
            {
              name: "西安钟楼",
              location: { lat: 34.261, lng: 108.942 },
              category: "风景名胜",
              sources: [{ provider: "AMAP", native_id: "B000TOWER" }],
            },
          ],
        }),
      },
    );
    expect(r.kind).toBe("not_found");
  });

  it("should_reject_card_without_coords_near_city (S6A)", () => {
    const hit = pickOriginCardNearCity(
      [{ name: "湖滨凯悦" }, { name: "Far", location: MACAU }],
      LISBON,
      ORIGIN_NEAR_CITY_KM,
    );
    expect(hit).toBeNull();
  });

  it("should_return_not_found_for_hangzhou_hotel_coords_in_lisbon (S6A)", async () => {
    const r = await resolvePlanOrigin(
      { query: "湖滨凯悦", destination: "里斯本", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: LISBON }),
        searchPlaces: async () => ({
          ok: true,
          data: [{ name: "杭州湖滨凯悦酒店", location: HANGZHOU }],
        }),
      },
    );
    expect(r.kind).toBe("not_found");
  });

  it("should_return_candidates_when_lisbon_hyatt_mismatches_湖滨凯悦 (S7)", async () => {
    const r = await resolvePlanOrigin(
      { query: "湖滨凯悦", destination: "里斯本", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: LISBON }),
        searchPlaces: async () => ({
          ok: true,
          data: [{ name: "Hyatt Regency Lisbon", location: { lat: 38.6985, lng: -9.1867 } }],
        }),
      },
    );
    expect(r.kind).toBe("candidates");
    if (r.kind === "candidates") {
      expect(r.cards[0]?.name).toBe("Hyatt Regency Lisbon");
    }
  });

  it("should_show_abc_candidates_when_brand_only_凯悦 (S7)", async () => {
    const searchPlaces = vi.fn(async () => ({
      ok: true as const,
      data: [
        { name: "Hyatt Regency Lisbon", location: { lat: 38.6985, lng: -9.1867 } },
        { name: "Grand Hyatt Lisbon", location: { lat: 38.71, lng: -9.15 } },
      ],
    }));
    const r = await resolvePlanOrigin(
      { query: "凯悦", destination: "里斯本", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: LISBON }),
        searchPlaces,
        providersForPin: () => ["GOOGLE_MAPS"],
      },
    );
    expect(r.kind).toBe("candidates");
    if (r.kind === "candidates") {
      expect(r.cards.map((c) => c.name)).toEqual([
        "Hyatt Regency Lisbon",
        "Grand Hyatt Lisbon",
      ]);
    }
    expect(searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringMatching(/hyatt/i),
        providers: ["GOOGLE_MAPS"],
        bias_radius_m: 50_000,
      }),
    );
  });

  it("should_map_pick_chip_to_candidate_name_not_token", () => {
    expect(
      originNameFromPick("__origin_pick__:0", [
        { name: "Hyatt Regency Lisbon" },
        { name: "Other Inn" },
      ]),
    ).toBe("Hyatt Regency Lisbon");
    expect(sanitizeDailyStartName("__origin_pick__:0")).toBe("");
    expect(sanitizeDailyStartName("Hyatt Regency Lisbon")).toBe("Hyatt Regency Lisbon");
  });

  it("should_resolve_pick_index_to_hit (S7)", () => {
    const r = resolveOriginPick(
      [{ name: "Hyatt Regency Lisbon", location: { lat: 38.7, lng: -9.18 } }],
      0,
    );
    expect(r).toEqual({
      kind: "hit",
      name: "Hyatt Regency Lisbon",
      lat: 38.7,
      lng: -9.18,
    });
  });

  it("should_return_not_found_when_cards_have_no_coords (S6A)", async () => {
    const r = await resolvePlanOrigin(
      { query: "湖滨凯悦", destination: "里斯本", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: LISBON }),
        searchPlaces: async () => ({
          ok: true,
          data: [{ name: "湖滨凯悦" }],
        }),
      },
    );
    expect(r.kind).toBe("not_found");
  });
});
