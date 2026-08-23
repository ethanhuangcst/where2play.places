import { describe, expect, it } from "vitest";
import { mapTimedPlanToItineraryDto } from "../src/core/itinerary-map";

const sampleAgentPlan = {
  detail: "timed" as const,
  timezone: "Asia/Taipei",
  preferences_applied: { pace: "relaxed" as const },
  search_anchor: {
    name: "Taipei",
    location: { lat: 25.03, lng: 121.56, crs: "WGS84" as const },
  },
  days: [
    {
      day_index: 1,
      date: "2026-08-22",
      stops: [],
      blocks: [
        {
          kind: "visit" as const,
          slot: { start: "09:30", end: "11:00" },
          place: {
            provider: "GOOGLE_MAPS",
            name: "Chiang Kai-shek Memorial Hall",
            category: "Attraction",
            photos: ["https://example.com/photo.jpg"],
            location: { lat: 25.03, lng: 121.52, crs: "WGS84" as const },
            sources: [
              {
                provider: "GOOGLE_MAPS",
                native_id: "ChIJreal123",
                deeplinks: {
                  details: "https://maps.example/details",
                  map: "https://maps.example/map",
                },
              },
            ],
          },
          legs_to_here: [
            {
              mode: "transit" as const,
              duration_min: 20,
              base_duration_min: 18,
              weather_buffer_min: 2,
              deeplinks: {},
            },
          ],
        },
        {
          kind: "meal" as const,
          meal: "lunch" as const,
          slot: { start: "12:00", end: "13:00" },
          options: [
            {
              place: {
                provider: "GOOGLE_MAPS",
                name: "Din Tai Fung",
                category: "Food",
                location: { lat: 25.04, lng: 121.5, crs: "WGS84" as const },
                sources: [
                  {
                    provider: "GOOGLE_MAPS",
                    native_id: "ChIJfood456",
                    deeplinks: { map: "https://maps.example/food" },
                  },
                ],
              },
              leg_from_previous: {
                mode: "walk" as const,
                duration_min: 10,
                base_duration_min: 10,
                weather_buffer_min: 0,
                deeplinks: {},
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("mapTimedPlanToItineraryDto", () => {
  it("should_map_visit_and_meal_blocks_to_slots", () => {
    const dto = mapTimedPlanToItineraryDto(sampleAgentPlan, {
      destination: "Taipei",
      days: 1,
    });
    expect(dto.destination).toBe("Taipei");
    expect(dto.daysCount).toBe(1);
    expect(dto.days).toHaveLength(1);
    const slots = dto.days[0]!.slots;
    expect(slots.some((s) => s.kind === "transit")).toBe(true);
    const place = slots.find((s) => s.kind === "place" && s.name.includes("Memorial"));
    expect(place?.kind).toBe("place");
    if (place?.kind === "place") {
      expect(place.photoUrl).toBe("https://example.com/photo.jpg");
      expect(place.nativeId).toBe("ChIJreal123");
      expect(place.nativeId?.startsWith("fixture_")).toBe(false);
      expect(place.detailsUrl).toBe("https://maps.example/details");
      expect(place.mapUrl).toBe("https://maps.example/map");
    }
    const food = slots.find((s) => s.kind === "place" && s.name.includes("Din Tai"));
    expect(food?.kind).toBe("place");
  });

  it("should_omit_photo_when_missing", () => {
    const noPhoto = structuredClone(sampleAgentPlan);
    delete (noPhoto.days[0]!.blocks[0] as { place: { photos?: string[] } }).place.photos;
    const dto = mapTimedPlanToItineraryDto(noPhoto, { destination: "Taipei", days: 1 });
    const place = dto.days[0]!.slots.find((s) => s.kind === "place");
    expect(place?.kind).toBe("place");
    if (place?.kind === "place") {
      expect(place.photoUrl).toBeUndefined();
    }
  });

  it("should_set_title_and_updatedAt", () => {
    const dto = mapTimedPlanToItineraryDto(sampleAgentPlan, {
      destination: "Taipei",
      days: 3,
    });
    expect(dto.title.length).toBeGreaterThan(0);
    expect(dto.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should_map_llm_arrange_day_blocks_to_slots", () => {
    const llmPlan = {
      detail: "timed" as const,
      days: [
        {
          day_index: 1,
          date: "2026-08-22",
          from_origin: { transport: "捷运", duration_min: 15 },
          blocks: [
            {
              name: "中正纪念堂",
              type: "attraction" as const,
              start_time: "10:00",
              duration_min: 90,
              reason: "地标",
              photos: ["https://cdn.example/cksmh.jpg"],
            },
            {
              name: "鼎泰丰",
              type: "lunch" as const,
              start_time: "12:00",
              duration_min: 60,
              reason: "午餐",
            },
          ],
        },
      ],
    };
    const dto = mapTimedPlanToItineraryDto(llmPlan, { destination: "台北", days: 1 });
    expect(dto.days).toHaveLength(1);
    const slots = dto.days[0]!.slots;
    expect(slots.some((s) => s.kind === "transit")).toBe(true);
    const attraction = slots.find((s) => s.kind === "place" && s.name === "中正纪念堂");
    expect(attraction?.kind).toBe("place");
    if (attraction?.kind === "place") {
      expect(attraction.start).toBe("10:00");
      expect(attraction.end).toBe("11:30");
      expect(attraction.photoUrl).toBe("https://cdn.example/cksmh.jpg");
      expect(attraction.summary).toContain("地标");
    }
    const lunch = slots.find((s) => s.kind === "place" && s.name === "鼎泰丰");
    expect(lunch?.kind).toBe("place");
    if (lunch?.kind === "place") {
      expect(lunch.placeKind).toBe("Food");
      expect(lunch.end).toBe("13:00");
    }
  });
});
