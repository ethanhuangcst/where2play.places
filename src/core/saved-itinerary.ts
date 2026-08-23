import type { ItineraryDto, ItineraryPlaceSlot } from "./itinerary-types";

export type SavedTripListItem = {
  id: string;
  title: string;
  destination: string;
  daysCount: number;
  coverUrl?: string;
  savedAt: string;
  summary?: string;
};

export type ChatMessageDto = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

export function coverUrlFromSnapshot(itinerary: ItineraryDto): string | undefined {
  for (const day of itinerary.days) {
    for (const slot of day.slots) {
      if (slot.kind === "place") {
        const place = slot as ItineraryPlaceSlot;
        if (place.photoUrl) return place.photoUrl;
      }
    }
  }
  return undefined;
}

export function summaryFromSnapshot(itinerary: ItineraryDto): string | undefined {
  const names: string[] = [];
  for (const day of itinerary.days) {
    for (const slot of day.slots) {
      if (slot.kind === "place" && names.length < 3) {
        names.push(slot.name);
      }
    }
  }
  return names.length > 0 ? names.join(" · ") : undefined;
}

export function toSavedTripListItem(row: {
  id: string;
  title: string;
  destination: string;
  daysCount: number;
  coverUrl: string | null;
  savedAt: Date;
  snapshot: unknown;
}): SavedTripListItem {
  const snapshot = row.snapshot as ItineraryDto;
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    daysCount: row.daysCount,
    coverUrl: row.coverUrl ?? coverUrlFromSnapshot(snapshot) ?? undefined,
    savedAt: row.savedAt.toISOString(),
    summary: summaryFromSnapshot(snapshot),
  };
}
