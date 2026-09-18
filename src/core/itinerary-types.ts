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
  /** Must-see place names from assistant step g (MVP-10). */
  mustInclude?: string[];
  locale?: string;
  /** Early discover Trip (2play §4.10). */
  tripId?: string;
  revision?: number;
  /**
   * Feature 41 Story 4 / MVP-T5:
   * - skeleton: stop after make + fetch skeleton
   * - full: discover → make → fill (NDJSON)
   * - fill: resume fill from existing trip skeleton (skip remake)
   */
  planMode?: "skeleton" | "full" | "fill";
  /** Story 5: origin resolved in destination (not hotel-only geocode). */
  originLat?: number;
  originLng?: number;
  /** ADR-053: full stay PlaceCard pointer from intake hit. */
  originStay?: {
    name: string;
    lat: number;
    lng: number;
    provider?: string;
    native_id?: string;
    photos?: string[];
  };
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
  /** From place name (previous stop). */
  from?: string;
  /** To place name (next stop). */
  to?: string;
  /** Structured legs for pill rendering (walk/transit/drive with duration). */
  legs?: Array<{
    mode: string;
    duration_min: number;
    recommended?: boolean;
  }>;
  /** Transit data quality: "directions" | "heuristic" | "partial". */
  outcome?: string;
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
  /** lunch | dinner | afternoon_tea when placeKind is meal */
  mealSlot?: string;
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
