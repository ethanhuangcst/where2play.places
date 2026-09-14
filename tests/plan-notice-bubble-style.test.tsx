/**
 * Assert T3 notice bubble CSS matches mockup white chat-bubble (not transparent agent lines).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TRAVOR = readFileSync(
  resolve(__dirname, "../app/mockup-travor.css"),
  "utf8",
);

describe("T3 notice bubble CSS matches mockup", () => {
  it("should_override_transparent_agent_line_with_white_notice_bubble", () => {
    // Transparent agent lines (24-P0-ui-B) must remain for progress / timeline.
    expect(TRAVOR).toMatch(
      /\[data-style="travor"\]\s*\.plan-nav__thread\s*\.bubble--agent\s*\{[^}]*background:\s*transparent/s,
    );
    // Notice bubbles must restore white chat card (06-plan-assistant-t3.html).
    const noticeBlock = TRAVOR.match(
      /\[data-style="travor"\]\s*\.plan-nav__thread\s*\.bubble--agent\.bubble--agent-notice[\s\S]*?max-width:\s*min\(100%,\s*22rem\);/,
    );
    expect(noticeBlock?.[0]).toBeTruthy();
    expect(noticeBlock?.[0]).toContain("background: #ffffff");
    expect(noticeBlock?.[0]).toContain("border-radius: 1rem 1rem 1rem 0.28rem");
    expect(noticeBlock?.[0]).toContain("font-weight: 600");
    expect(noticeBlock?.[0]).not.toContain("background: transparent");
  });
});
