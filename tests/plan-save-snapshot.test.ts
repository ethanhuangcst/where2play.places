import { afterEach, describe, expect, it } from "vitest";
import {
  chatContextMaxChars,
  serializePlanSaveMessages,
  stripItinerarySnapshot,
} from "../src/core/plan-save-snapshot";
import type { ItineraryDto } from "../src/core/itinerary-types";

const SAMPLE: ItineraryDto = {
  title: "London 2 days",
  destination: "London",
  daysCount: 2,
  updatedAt: "2026-08-23T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "Day 1", title: "Explore", tags: ["culture"] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "British Museum",
          summary: "Highlights tour",
        },
      ],
    },
  ],
};

describe("plan-save-snapshot", () => {
  afterEach(() => {
    delete process.env.CHAT_CONTEXT_MAX_CHARS;
  });

  it("should_strip_visa_tips_and_artifacts_from_snapshot", () => {
    const dirty = {
      ...SAMPLE,
      visa: { requirement: "visa_required" },
      tips: { intro: "secret" },
      artifacts: { tips: { intro: "x" } },
      travelTips: { intro: "leak" },
    };
    const out = stripItinerarySnapshot(dirty);
    expect(out).toEqual(SAMPLE);
    expect(JSON.stringify(out)).not.toContain("visa_required");
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(JSON.stringify(out)).not.toContain("travelTips");
  });

  it("should_serialize_intake_user_then_assistant_status_and_complete", () => {
    const out = serializePlanSaveMessages({
      intakeAnswers: {
        b: "Hyatt",
        c: "09:00",
        d: "couple_romance",
        e: "",
        f: "transit_walk",
        g: undefined,
        h: "  ",
      },
      statusLines: ["Discovering…", "Skeleton ready"],
      completeLine: "Plan complete",
    });
    expect(out).toEqual([
      { role: "user", content: "Hyatt" },
      { role: "user", content: "09:00" },
      { role: "user", content: "couple_romance" },
      { role: "user", content: "transit_walk" },
      { role: "assistant", content: "Discovering…" },
      { role: "assistant", content: "Skeleton ready" },
      { role: "assistant", content: "Plan complete" },
    ]);
  });

  it("should_truncate_serialized_messages_keeping_tail", () => {
    const out = serializePlanSaveMessages({
      intakeAnswers: { b: "a".repeat(100) },
      statusLines: ["b".repeat(100), "keep-me"],
      completeLine: null,
      maxChars: 50,
    });
    expect(out.some((m) => m.content === "keep-me" || m.content.endsWith("keep-me"))).toBe(true);
    const total = out.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(50);
  });

  it("should_use_CHAT_CONTEXT_MAX_CHARS_when_set", () => {
    process.env.CHAT_CONTEXT_MAX_CHARS = "12000";
    expect(chatContextMaxChars()).toBe(12000);
  });

  it("should_default_chat_max_chars_to_8000", () => {
    expect(chatContextMaxChars()).toBe(8000);
  });
});
