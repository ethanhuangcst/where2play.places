export type PlanBoundaries = {
  destination: string;
  days: number;
  /** Local calendar start YYYY-MM-DD; maps to agent bounds.start */
  startDate: string;
  partySize?: number;
  tripType?: string;
  budget?: string;
  pace?: string;
  transport?: string;
  dailyStart?: string;
  dailyEnd?: string;
  timeFrom?: string;
  timeTo?: string;
  interests?: string[];
  constraints?: string;
  locale?: string;
};

/** Progressive discover preview (isomorphic slot fields). */
export type CandidatePlacePreview = {
  name: string;
  placeKind: string;
  photoUrl?: string;
  summary?: string;
};

export type ItineraryTransitSlot = {
  kind: "transit";
  start: string;
  end?: string;
  text: string;
};

export type ItineraryPlaceSlot = {
  kind: "place";
  start: string;
  end: string;
  placeKind: string;
  name: string;
  summary: string;
  photoUrl?: string;
  provider?: string;
  nativeId?: string;
  detailsUrl?: string;
  mapUrl?: string;
};

export type ItinerarySlot = ItineraryTransitSlot | ItineraryPlaceSlot;

export type ItineraryDayDto = {
  dayIndex: number;
  highlights: { label: string; title: string; theme?: string; tags: string[] };
  meta?: { transport?: string; pace?: string; window?: string };
  slots: ItinerarySlot[];
};

export type ItineraryDto = {
  title: string;
  destination: string;
  daysCount: number;
  updatedAt: string;
  days: ItineraryDayDto[];
};
