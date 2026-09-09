import { describe, expect, it } from "vitest";
import {
  isBrandOnlyOriginQuery,
  isFullOriginNameMatch,
  originNameTokensCovered,
  originSearchQuery,
  pickAutoMatchingOrigin,
} from "../src/core/plan-origin-name-match";

describe("originNameTokensCovered (TC-M23-S7-01)", () => {
  it("should_auto_pass_when_user_token_凯悦_covers_Hyatt", () => {
    expect(originNameTokensCovered("凯悦", "Hyatt Regency Lisbon")).toBe(true);
  });

  it("should_reject_when_湖滨_not_in_lisbon_hyatt", () => {
    expect(originNameTokensCovered("湖滨凯悦", "Hyatt Regency Lisbon")).toBe(false);
  });

  it("should_pass_when_place_contains_user_substring", () => {
    expect(originNameTokensCovered("Hills Hotel", "Hills Hotel Lisboa")).toBe(true);
  });

  it("should_not_auto_pick_brand_or_short_cjk", () => {
    const hit = pickAutoMatchingOrigin("凯悦", [
      { name: "Hyatt Regency Lisbon", location: { lat: 38.7, lng: -9.1 } },
    ]);
    expect(hit).toBeNull();
  });

  it("should_treat_santai_road_fragment_as_partial", () => {
    expect(
      isFullOriginNameMatch("三台", "西湖若白雅苑民宿(三台山路8号分店)"),
    ).toBe(false);
    expect(isFullOriginNameMatch("三台山庄", "三台山庄")).toBe(true);
    expect(isFullOriginNameMatch("Hills Hotel Lisbon", "Hills Hotel Lisboa")).toBe(true);
  });

  it("should_return_null_when_no_token_coverage", () => {
    const hit = pickAutoMatchingOrigin("湖滨凯悦", [
      { name: "Hyatt Regency Lisbon", location: { lat: 38.7, lng: -9.1 } },
    ]);
    expect(hit).toBeNull();
  });

  it("should_treat_凯悦_as_brand_only_and_expand_google_query", () => {
    expect(isBrandOnlyOriginQuery("凯悦")).toBe(true);
    expect(isBrandOnlyOriginQuery("Hyatt")).toBe(true);
    expect(isBrandOnlyOriginQuery("湖滨凯悦")).toBe(false);
    expect(originSearchQuery("凯悦").toLowerCase()).toContain("hyatt");
    expect(originSearchQuery("Hills Hotel")).toBe("Hills Hotel");
  });

  it("should_strip_parenthetical_branch_from_search_query (ADR-053)", () => {
    const q1 = originSearchQuery("凯悦逸扉酒店(西安钟楼回民街店)");
    expect(q1).not.toMatch(/钟楼|回民街/);
    expect(q1).toContain("凯悦逸扉酒店");
    const q2 = originSearchQuery("凯悦逸扉酒店（西安钟楼回民街店）");
    expect(q2).not.toMatch(/钟楼|回民街/);
    expect(originSearchQuery("Hyatt Place (Xi'an Bell Tower)").toLowerCase()).toContain("hyatt place");
    expect(originSearchQuery("Hyatt Place (Xi'an Bell Tower)")).not.toMatch(/bell tower/i);
  });
});
