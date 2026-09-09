import { describe, expect, it } from "vitest";
import { nextPanelSizeRem } from "../src/core/plan-nav-resize";

describe("nextPanelSizeRem", () => {
  it("should_grow_when_dragging_out_from_top_left", () => {
    const next = nextPanelSizeRem({
      startW: 30,
      startH: 50,
      startX: 400,
      startY: 200,
      clientX: 384,
      clientY: 184,
      rootPx: 16,
    });
    expect(next.w).toBe(31);
    expect(next.h).toBe(51);
  });

  it("should_shrink_when_dragging_in_toward_bottom_right", () => {
    const next = nextPanelSizeRem({
      startW: 30,
      startH: 50,
      startX: 400,
      startY: 200,
      clientX: 416,
      clientY: 216,
      rootPx: 16,
    });
    expect(next.w).toBe(29);
    expect(next.h).toBe(49);
  });
});
