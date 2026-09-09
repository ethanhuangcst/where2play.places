import { describe, expect, it } from "vitest";
import { mustSeeNamesFromCandidates } from "@/src/core/plan-iconic-parse";

describe("TC-M19-79-01 mustSeeNamesFromCandidates nomination order", () => {
  it("should_return_must_see_names_in_candidate_order_not_heat", () => {
    const slice = {
      candidates: {
        places: [
          { name: "Low Signal", must_see: true, user_ratings_total: 100 },
          { name: "Hot Alpha", must_see: true, user_ratings_total: 40_000 },
          { name: "Plain Spot", must_see: false, user_ratings_total: 999_999 },
          { name: "Hot Beta", must_see: true, user_ratings_total: 12_000 },
        ],
      },
    };
    expect(mustSeeNamesFromCandidates(slice, 4)).toEqual(["Low Signal", "Hot Alpha", "Hot Beta"]);
  });
});
