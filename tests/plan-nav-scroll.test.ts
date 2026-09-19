import { describe, expect, it } from "vitest";
import { isNearScrollBottom, stickThreadBodyToEnd } from "@/src/core/plan-nav-scroll";

describe("plan-nav thread scroll", () => {
  it("should_report_near_bottom_when_within_threshold", () => {
    expect(
      isNearScrollBottom({ scrollTop: 400, clientHeight: 200, scrollHeight: 650 }, 72),
    ).toBe(true);
  });

  it("should_report_not_near_bottom_when_user_scrolled_up", () => {
    expect(
      isNearScrollBottom({ scrollTop: 0, clientHeight: 200, scrollHeight: 800 }, 72),
    ).toBe(false);
  });

  it("should_not_move_scrollTop_when_user_is_reading_history", () => {
    const el = { scrollTop: 40, scrollHeight: 900 };
    stickThreadBodyToEnd(el, false);
    expect(el.scrollTop).toBe(40);
  });

  it("should_stick_to_end_when_following_latest", () => {
    const el = { scrollTop: 40, scrollHeight: 900 };
    stickThreadBodyToEnd(el, true);
    expect(el.scrollTop).toBe(900);
  });
});
