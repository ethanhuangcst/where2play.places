import { describe, expect, it } from "vitest";
import { collapseSkeletonPreviewDays } from "../src/core/plan-skeleton-preview";

describe("TC-M18-72 skeleton preview collapse", () => {
  it("should_collapse_repeated_hotel_stay_across_days", () => {
    const out = collapseSkeletonPreviewDays([
      {
        dayIndex: 1,
        theme: "Hills",
        stops: [
          { name: "Hills Hotel", kind: "stay" },
          { name: "Tower", kind: "attraction" },
        ],
      },
      {
        dayIndex: 2,
        theme: "Coast",
        stops: [
          { name: "Hills Hotel", kind: "stay" },
          { name: "Beach", kind: "attraction" },
        ],
      },
    ]);
    expect(out[0]?.stops[0]?.kind).toBe("stay_origin");
    expect(out[1]?.stops[0]?.kind).toBe("stay_origin");
    expect(out[0]?.theme).toBe("Hills");
    expect(out[1]?.stops.some((s) => s.name === "Beach")).toBe(true);
  });
});
