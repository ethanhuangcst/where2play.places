import { describe, expect, it, vi } from "vitest";
import {
  ORIGIN_NEAR_CITY_KM,
  pickOriginCardNearCity,
  resolvePlanOrigin,
} from "../src/core/plan-resolve-origin";

const LISBON = { lat: 38.7223, lng: -9.1393 };
const MACAU = { lat: 22.186785, lng: 113.549525 };

describe("pickOriginCardNearCity (TC-M21-41-21)", () => {
  it("should_skip_empty_via_resolvePlanOrigin", async () => {
    const r = await resolvePlanOrigin(
      { query: "  ", destination: "里斯本", locale: "CN" },
      {
        searchPlaces: async () => ({ ok: true, data: [] }),
        geocode: async () => ({ ok: true, data: LISBON }),
      },
    );
    expect(r.kind).toBe("skip");
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

  it("should_hit_when_search_returns_lisbon_card", async () => {
    const searchPlaces = vi.fn(async () => ({
      ok: true,
      data: [{ name: "Hills Hotel Lisboa", location: { lat: 38.73, lng: -9.14 } }],
    }));
    const geocode = vi.fn(async (input: { query: string }) => {
      expect(input.query).toBe("里斯本");
      return { ok: true as const, data: LISBON };
    });
    const r = await resolvePlanOrigin(
      { query: "Hills Hotel Lisboa", destination: "里斯本", locale: "CN" },
      { searchPlaces, geocode },
    );
    expect(r).toEqual({
      kind: "hit",
      name: "Hills Hotel Lisboa",
      lat: 38.73,
      lng: -9.14,
    });
    expect(searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Hills Hotel Lisboa", address: "里斯本" }),
    );
  });

  it("should_degrade_to_name_when_search_fails", async () => {
    const r = await resolvePlanOrigin(
      { query: "My Inn", destination: "里斯本", locale: "CN" },
      {
        geocode: async () => ({ ok: true, data: LISBON }),
        searchPlaces: async () => ({ ok: false }),
      },
    );
    expect(r).toEqual({ kind: "degraded", name: "My Inn" });
  });
});
