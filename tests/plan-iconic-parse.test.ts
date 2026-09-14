import { describe, expect, it } from "vitest";
import { mustSeeNamesFromCandidates } from "@/src/core/plan-iconic-parse";

describe("mustSeeNamesFromCandidates (ADR-069 iconic from tips)", () => {
  it("should_prefer_artifacts_tips_iconic_places_over_candidates", () => {
    const slice = {
      artifacts: {
        tips: { iconic_places: ["Tower", "Palace", "Tower"] },
      },
      candidates: {
        places: [
          { name: "Ignored Flag", must_see: true },
          { name: "Also Ignored", must_see: true },
        ],
      },
    };
    expect(mustSeeNamesFromCandidates(slice, 4)).toEqual(["Tower", "Palace"]);
  });

  it("should_fall_back_to_travel_tips_iconic_places", () => {
    const slice = {
      travel_tips: { iconic_places: ["Belém Tower", "Sintra"] },
      candidates: { places: [{ name: "Mall", must_see: true }] },
    };
    expect(mustSeeNamesFromCandidates(slice, 3, 5)).toEqual(["Belém Tower", "Sintra"]);
  });

  it("should_fall_back_to_tips_iconic_places", () => {
    const slice = {
      tips: { iconic_places: ["Hot Alpha", "Hot Beta"] },
    };
    expect(mustSeeNamesFromCandidates(slice, 4)).toEqual(["Hot Alpha", "Hot Beta"]);
  });

  it("should_return_empty_when_tips_missing_without_using_must_see_flags", () => {
    const slice = {
      candidates: {
        places: [
          { name: "Low Signal", must_see: true },
          { name: "Hot Alpha", must_see: true },
        ],
      },
    };
    expect(mustSeeNamesFromCandidates(slice, 4)).toEqual([]);
  });
});
