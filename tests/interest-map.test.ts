import { describe, expect, it } from "vitest";
import {
  planInterestsToProfileInterests,
  profileInterestsToPlanInterests,
} from "@/src/core/interest-map";

describe("interest-map", () => {
  it("should_map_profile_chips_to_plan_interests", () => {
    expect(profileInterestsToPlanInterests(["tourist_attraction", "restaurant"])).toEqual([
      "tourist_attraction",
      "restaurant",
    ]);
  });

  it("should_map_plan_interests_to_profile_ids", () => {
    expect(planInterestsToProfileInterests(["museum", "bogus", "park"])).toEqual([
      "museum",
      "park",
    ]);
  });
});
