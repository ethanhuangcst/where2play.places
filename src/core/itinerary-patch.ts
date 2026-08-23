import type { ItineraryDayDto, ItineraryDto, ItinerarySlot } from "./itinerary-types";

export type ItineraryDayPatch = {
  dayIndex: number;
  highlights?: ItineraryDayDto["highlights"];
  meta?: ItineraryDayDto["meta"];
  slots?: ItinerarySlot[];
};

export type ItineraryPatch = {
  title?: string;
  destination?: string;
  daysCount?: number;
  days?: ItineraryDayPatch[];
};

export type AssistantItineraryResult = {
  itineraryPatch?: ItineraryPatch | null;
  itinerary?: ItineraryDto | null;
};

/** Prefer itineraryPatch; else full itinerary replace; else keep current. */
export function applyAssistantItineraryResult(
  current: ItineraryDto,
  result: AssistantItineraryResult,
): ItineraryDto {
  if (result.itineraryPatch && hasPatchContent(result.itineraryPatch)) {
    return applyItineraryPatch(current, result.itineraryPatch);
  }
  if (result.itinerary && Array.isArray(result.itinerary.days)) {
    return {
      ...result.itinerary,
      updatedAt: new Date().toISOString(),
    };
  }
  return current;
}

function hasPatchContent(patch: ItineraryPatch): boolean {
  return Boolean(
    patch.title != null ||
      patch.destination != null ||
      patch.daysCount != null ||
      (patch.days && patch.days.length > 0),
  );
}

export function applyItineraryPatch(
  current: ItineraryDto,
  patch: ItineraryPatch,
): ItineraryDto {
  const days = current.days.map((d) => ({ ...d, slots: [...d.slots] }));
  for (const dayPatch of patch.days ?? []) {
    const idx = days.findIndex((d) => d.dayIndex === dayPatch.dayIndex);
    if (idx < 0) continue;
    const prev = days[idx]!;
    days[idx] = {
      ...prev,
      ...(dayPatch.highlights ? { highlights: dayPatch.highlights } : {}),
      ...(dayPatch.meta ? { meta: dayPatch.meta } : {}),
      ...(dayPatch.slots ? { slots: dayPatch.slots } : {}),
    };
  }
  return {
    ...current,
    ...(patch.title != null ? { title: patch.title } : {}),
    ...(patch.destination != null ? { destination: patch.destination } : {}),
    ...(patch.daysCount != null ? { daysCount: patch.daysCount } : {}),
    days,
    updatedAt: new Date().toISOString(),
  };
}
