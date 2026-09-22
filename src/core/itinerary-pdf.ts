import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ItineraryDto, ItinerarySlot } from "./itinerary-types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE_HEIGHT = 16;
const TITLE_SIZE = 18;
const HEADING_SIZE = 13;
const BODY_SIZE = 11;

/** StandardFonts are WinAnsi — strip unsupported glyphs rather than inventing copy. */
export function pdfSafe(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slotLabelForPdf(slot: ItinerarySlot): string {
  if (slot.kind === "transit") {
    const time = [slot.start, slot.end].filter(Boolean).join("-");
    const text = slot.text?.trim() || "";
    return pdfSafe([time, text].filter(Boolean).join("  ") || "-");
  }
  const time = [slot.start, slot.end].filter(Boolean).join("-");
  const name = slot.name?.trim() || "-";
  const summary = slot.summary?.trim() || "";
  const head = [time, name].filter(Boolean).join("  ");
  return pdfSafe(summary ? `${head} - ${summary}` : head);
}

/** Plain text lines that will be drawn into the PDF (testable; no invented POIs). */
export function itineraryPdfLines(itinerary: ItineraryDto): string[] {
  const lines: string[] = [];
  const title = itinerary.title?.trim() || itinerary.destination?.trim() || "Itinerary";
  lines.push(pdfSafe(title) || "Itinerary");
  const meta = [
    itinerary.destination?.trim(),
    itinerary.daysCount ? `${itinerary.daysCount} day(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) lines.push(pdfSafe(meta));

  const days = [...(itinerary.days ?? [])].sort((a, b) => a.dayIndex - b.dayIndex);
  for (const day of days) {
    lines.push(`Day ${day.dayIndex}`);
    const hl = day.highlights?.title?.trim();
    if (hl) lines.push(pdfSafe(hl));
    for (const slot of day.slots ?? []) {
      lines.push(slotLabelForPdf(slot));
    }
  }
  return lines;
}

/**
 * Build a PDF from an ItineraryDto. Missing place fields become "-" / omitted —
 * never invent POI names or summaries.
 */
export async function itineraryToPdfBytes(itinerary: ItineraryDto): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const draw = (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const safe = pdfSafe(text) || "-";
    const words = safe.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > maxWidth && line) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(line, {
          x: MARGIN,
          y: y - size,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= LINE_HEIGHT;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      ensureSpace(LINE_HEIGHT);
      page.drawText(line, {
        x: MARGIN,
        y: y - size,
        size,
        font: f,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= LINE_HEIGHT;
    }
  };

  const content = itineraryPdfLines(itinerary);
  if (content[0]) {
    draw(content[0], TITLE_SIZE, true);
    y -= 6;
  }
  for (let i = 1; i < content.length; i++) {
    const line = content[i]!;
    if (line.startsWith("Day ")) {
      y -= 8;
      draw(line, HEADING_SIZE, true);
    } else {
      draw(line, BODY_SIZE);
    }
  }

  return doc.save();
}

/** Safe download filename from itinerary title/destination. */
export function itineraryPdfFilename(itinerary: ItineraryDto): string {
  const raw = (itinerary.title || itinerary.destination || "itinerary").trim();
  const safe =
    raw
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "itinerary";
  return `${safe}.pdf`;
}
