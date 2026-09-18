import { describe, expect, it, vi } from "vitest";
import { resolvePlaceDetailsWithNameFallback } from "../src/core/place-details-resolve";

describe("resolvePlaceDetailsWithNameFallback", () => {
  it("should_return_details_when_provider_card_has_photo", async () => {
    const getPlaceDetails = vi.fn(async () => ({
      ok: true,
      data: {
        name: "龙井村风景区",
        photos: ["https://store.is.autonavi.com/showpic/a"],
      },
    }));
    const searchPlaces = vi.fn();
    const r = await resolvePlaceDetailsWithNameFallback(
      { provider: "AMAP", nativeId: "B0FFJ14EOV", locale: "zh-CN", name: "龙井村" },
      { getPlaceDetails, searchPlaces },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.photos?.[0]).toMatch(/^https:/);
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("should_search_by_name_when_amap_tip_id_has_empty_details", async () => {
    const getPlaceDetails = vi.fn(async () => ({ ok: true, data: null }));
    const searchPlaces = vi.fn(async () => ({
      ok: true,
      data: [
        {
          name: "龙井村牌坊",
          photos: ["https://store.is.autonavi.com/showpic/gate"],
          sources: [{ provider: "AMAP", native_id: "B0MG95PP15" }],
        },
        {
          name: "龙井村321号",
          photos: [],
        },
      ],
    }));
    const r = await resolvePlaceDetailsWithNameFallback(
      {
        provider: "AMAP",
        nativeId: "B023B08NUI",
        locale: "zh-CN",
        name: "龙井村",
        city: "杭州",
      },
      { getPlaceDetails, searchPlaces },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe("龙井村牌坊");
      expect(r.data.photos?.[0]).toMatch(/gate/);
    }
    expect(searchPlaces).toHaveBeenCalledOnce();
  });

  it("should_reject_verify_harness_ids", async () => {
    const r = await resolvePlaceDetailsWithNameFallback(
      { provider: "AMAP", nativeId: "verify_longjing", locale: "zh-CN", name: "龙井村" },
      {
        getPlaceDetails: vi.fn(),
        searchPlaces: vi.fn(),
      },
    );
    expect(r).toEqual({ ok: false, key: "errors.invalid_input" });
  });
});
