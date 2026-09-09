import { describe, expect, it } from "vitest";
import { BUDGET_OPTION_KEYS, normalizeBudgetKey } from "../src/core/plan-budget";

describe("plan-budget", () => {
  it("should_expose_three_tiers_including_luxury", () => {
    expect(BUDGET_OPTION_KEYS).toEqual(["economy", "mid", "luxury"]);
  });

  it("should_normalize_comfort_alias_to_luxury", () => {
    expect(normalizeBudgetKey("comfort")).toBe("luxury");
    expect(normalizeBudgetKey("$$$豪华")).toBe("luxury");
  });

  it("should_normalize_mid_from_适中", () => {
    expect(normalizeBudgetKey("$$适中")).toBe("mid");
  });
});
