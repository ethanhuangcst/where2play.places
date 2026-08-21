import { describe, expect, it } from "vitest";
import {
  INTEREST_IDS,
  isInterestId,
  normalizeInterests,
  INTEREST_LABEL_KEYS,
} from "@/src/core/interests";

describe("interests", () => {
  it("should_expose_nine_canonical_ids", () => {
    expect(INTEREST_IDS).toHaveLength(9);
    expect(INTEREST_IDS).toContain("tourist_attraction");
    expect(INTEREST_IDS).toContain("natural_feature");
  });

  it("should_normalize_and_dedupe", () => {
    expect(normalizeInterests(["museum", "museum", "bogus", "park"])).toEqual(["museum", "park"]);
  });

  it("should_validate_interest_ids", () => {
    expect(isInterestId("spa")).toBe(true);
    expect(isInterestId("not_real")).toBe(false);
  });

  it("should_map_each_id_to_play_label_key", () => {
    for (const id of INTEREST_IDS) {
      expect(INTEREST_LABEL_KEYS[id]).toBe(`play.interest.${id}`);
    }
  });
});
