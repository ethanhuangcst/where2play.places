/**
 * Story 28 — ItineraryDto → PDF; missing fields must not invent POI names.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import {
  itineraryPdfFilename,
  itineraryPdfLines,
  itineraryToPdfBytes,
} from "@/src/core/itinerary-pdf";

describe("itineraryToPdfBytes (Story 28)", () => {
  it("should_omit_invented_names_when_slot_summary_missing", async () => {
    const dto: ItineraryDto = {
      title: "Lisbon 2 days",
      destination: "Lisbon",
      daysCount: 2,
      updatedAt: "2026-09-20T00:00:00.000Z",
      days: [
        {
          dayIndex: 1,
          highlights: { label: "Day 1", title: "Explore", tags: [] },
          slots: [
            {
              kind: "place",
              start: "10:00",
              end: "12:00",
              placeKind: "Attraction",
              name: "Belem Tower",
              summary: "",
            },
            {
              kind: "place",
              start: "14:00",
              end: "16:00",
              placeKind: "Attraction",
              name: "",
              summary: "",
            },
          ],
        },
      ],
    };

    const lines = itineraryPdfLines(dto);
    expect(lines.some((l) => l.includes("Belem Tower"))).toBe(true);
    const emptyNameLine = lines.find((l) => l.startsWith("14:00-16:00"));
    expect(emptyNameLine).toBeTruthy();
    expect(emptyNameLine).toMatch(/-$/); // placeholder, not a fabricated POI
    expect(lines.join("\n")).not.toContain("Invented Landmark");
    expect(lines.join("\n")).not.toContain("Must-see Plaza");
    expect(lines.join("\n")).not.toContain("Famous Cathedral");

    const bytes = await itineraryToPdfBytes(dto);
    expect(bytes.byteLength).toBeGreaterThan(100);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("should_build_safe_filename_from_title", () => {
    expect(
      itineraryPdfFilename({
        title: "Lisbon / Day 1!",
        destination: "Lisbon",
        daysCount: 1,
        updatedAt: "",
        days: [],
      }),
    ).toBe("Lisbon_Day_1.pdf");
  });
});
