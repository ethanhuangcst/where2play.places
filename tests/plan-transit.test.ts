import { describe, expect, it } from "vitest";
import {
  normalizeTransitKey,
  transitKeyForAgent,
  TRANSIT_AGENT_PHRASE,
} from "../src/core/plan-transit";

describe("plan-transit", () => {
  it("should_map_transit_walk_to_public_plus_walk_phrase", () => {
    expect(transitKeyForAgent("transit_walk")).toBe(TRANSIT_AGENT_PHRASE.transit_walk);
    expect(transitKeyForAgent("transit_walk")).toBe("公共交通+步行");
  });

  it("should_map_drive_walk_to_drive_taxi_plus_walk_phrase", () => {
    expect(transitKeyForAgent("drive_walk")).toBe("自驾/打车+步行");
  });

  it("should_normalize_legacy_public_to_transit_walk", () => {
    expect(normalizeTransitKey("public")).toBe("transit_walk");
    expect(normalizeTransitKey("drive")).toBe("drive_walk");
  });
});
