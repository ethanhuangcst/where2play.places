import { describe, expect, it } from "vitest";
import type { ItineraryDto } from "../src/core/itinerary-types";
import {
  buildAssistantSystemPrompt,
  buildAssistantUserPayload,
  parseAssistantModelText,
} from "../src/core/chat-assistant";

const itinerary: ItineraryDto = {
  title: "Shenyang 3d",
  destination: "沈阳",
  daysCount: 1,
  updatedAt: "2026-08-22T00:00:00.000Z",
  days: [
    {
      dayIndex: 1,
      highlights: { label: "D1", title: "Palace", tags: ["history"] },
      slots: [
        {
          kind: "place",
          start: "10:00",
          end: "12:00",
          placeKind: "Attraction",
          name: "故宫",
          summary: "palace",
        },
      ],
    },
  ],
};

describe("chat-assistant (U-07b)", () => {
  it("should_include_itinerary_summary_in_system_prompt", () => {
    const sys = buildAssistantSystemPrompt({ locale: "CN", itinerary });
    expect(sys).toMatch(/故宫|Shenyang|沈阳/);
    expect(sys).toMatch(/itineraryPatch/i);
    expect(sys).toMatch(/Do NOT call or suggest places-agent/i);
    expect(sys).toMatch(/plan_itinerary/i); // forbidden path named explicitly
  });

  it("should_build_user_payload_with_messages", () => {
    const user = buildAssistantUserPayload({
      messages: [{ role: "user", content: "把晚上提早" }],
      itinerary,
    });
    expect(user).toContain("把晚上提早");
    expect(user).toContain("故宫");
  });

  it("should_parse_reply_and_patch_from_model_json", () => {
    const raw = `\`\`\`json
{"reply":"已提早","itineraryPatch":{"days":[{"dayIndex":1,"slots":[{"kind":"place","start":"10:00","end":"11:00","placeKind":"Attraction","name":"故宫","summary":"ok"}]}]}}
\`\`\``;
    const parsed = parseAssistantModelText(raw);
    expect(parsed.reply).toBe("已提早");
    expect(parsed.itineraryPatch?.days?.[0]?.dayIndex).toBe(1);
  });
});
