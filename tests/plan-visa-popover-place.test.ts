import { describe, expect, it } from "vitest";
import { visaPopoverPlacement } from "../src/core/plan-visa-popover-place";

describe("visaPopoverPlacement", () => {
  it("should_open_below_when_card_is_near_the_top", () => {
    const place = visaPopoverPlacement({
      anchorTop: 180,
      anchorBottom: 204,
      viewportHeight: 800,
    });
    expect(place.side).toBe("below");
    expect(place.maxHeightPx).toBe(800 - 204 - 12);
  });

  it("should_flip_above_when_below_is_shorter_than_12rem", () => {
    const place = visaPopoverPlacement({
      anchorTop: 640,
      anchorBottom: 664,
      viewportHeight: 720,
    });
    expect(place.side).toBe("above");
    expect(place.maxHeightPx).toBe(640 - 12);
  });

  it("should_stay_below_when_below_meets_the_minimum", () => {
    const place = visaPopoverPlacement({
      anchorTop: 400,
      anchorBottom: 424,
      viewportHeight: 800,
    });
    expect(place.side).toBe("below");
  });
});
