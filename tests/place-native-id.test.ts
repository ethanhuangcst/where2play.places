import { describe, expect, it } from "vitest";
import {
  isResolvablePlaceNativeId,
  pickResolvablePlacePointer,
} from "../src/core/place-native-id";
import { mapStopDisplayToPlaceSlot } from "../src/core/itinerary-skeleton-map";

describe("place-native-id", () => {
  it("should_reject_harness_verify_ids", () => {
    expect(isResolvablePlaceNativeId("GOOGLE_MAPS", "verify_belem")).toBe(false);
    expect(isResolvablePlaceNativeId("GOOGLE_MAPS", "verify_jeronimos")).toBe(false);
    expect(isResolvablePlaceNativeId("GOOGLE_MAPS", "fixture_tower")).toBe(false);
  });

  it("should_accept_google_chij_and_amap_b0_or_bv", () => {
    expect(isResolvablePlaceNativeId("GOOGLE_MAPS", "ChIJtXlmyZ4zGQ0RUHvpxx9LsF4")).toBe(true);
    expect(isResolvablePlaceNativeId("AMAP", "B0KDJ78DYD")).toBe(true);
    expect(isResolvablePlaceNativeId("AMAP", "BV10389423")).toBe(true);
    expect(isResolvablePlaceNativeId("AMAP", "tip:龙井村")).toBe(false);
  });

  it("should_prefer_resolvable_pool_id_over_verify_stop_id", () => {
    const t = (key: string) => key;
    const slot = mapStopDisplayToPlaceSlot(
      {
        stop: {
          name: "Torre de Belém",
          kind: "attraction",
          provider: "GOOGLE_MAPS",
          native_id: "verify_belem",
          card: null,
          deeplinks: {},
        },
        slot: { start: "10:00", end: "11:00" },
      },
      t,
      {
        provider: "GOOGLE_MAPS",
        nativeId: "verify_belem",
        pool: {
          places: [
            {
              name: "Torre de Belém",
              provider: "GOOGLE_MAPS",
              photos: ["https://cdn.example/belem.jpg"],
              sources: [
                {
                  provider: "GOOGLE_MAPS",
                  native_id: "ChIJtXlmyZ4zGQ0RUHvpxx9LsF4",
                },
              ],
            },
          ],
        },
      },
    );
    expect(slot.nativeId).toBe("ChIJtXlmyZ4zGQ0RUHvpxx9LsF4");
    expect(slot.photoUrl).toBe("https://cdn.example/belem.jpg");
  });

  it("should_pick_first_resolvable_pointer", () => {
    const hit = pickResolvablePlacePointer([
      { provider: "GOOGLE_MAPS", nativeId: "verify_belem" },
      { provider: "GOOGLE_MAPS", nativeId: "ChIJtXlmyZ4zGQ0RUHvpxx9LsF4" },
    ]);
    expect(hit?.nativeId).toBe("ChIJtXlmyZ4zGQ0RUHvpxx9LsF4");
  });
});
