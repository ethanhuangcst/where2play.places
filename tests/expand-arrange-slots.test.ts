import { describe, expect, it } from "vitest";
import { expandArrangeDayToSlots } from "../src/core/itinerary-map";

describe("expandArrangeDayToSlots", () => {
  it("should_map_attraction_and_meal_with_mealLabel", () => {
    const expanded = expandArrangeDayToSlots(
      [
        {
          name: "Big Wild Goose Pagoda",
          type: "attraction",
          start_time: "09:30",
          duration_min: 90,
          reason: "Iconic",
          photos: ["https://example.com/a.jpg"],
        },
        {
          name: "Lunch Spot",
          type: "lunch",
          start_time: "12:00",
          duration_min: 60,
          reason: "Local favorite",
        },
        {
          name: "Cafe Late",
          type: "lunch",
          start_time: "15:30",
          duration_min: 45,
          reason: "Tea break",
        },
        {
          name: "Night Market",
          type: "dinner",
          start_time: "18:30",
          duration_min: 75,
          reason: "Street food",
        },
      ],
      {},
      { transport: "transit" },
    );

    const previews = expanded.map((e) => e.preview);
    const place = previews.find((p) => p.name === "Big Wild Goose Pagoda");
    expect(place?.kind).toBe("place");
    expect(place?.window).toBe("09:30–11:00");
    expect(place?.reason).toBe("Iconic");

    const lunch = previews.find((p) => p.name === "Lunch Spot");
    expect(lunch?.kind).toBe("meal");
    expect(lunch?.mealLabel).toBe("lunch");

    const tea = previews.find((p) => p.name === "Cafe Late");
    expect(tea?.kind).toBe("meal");
    expect(tea?.mealLabel).toBe("afternoon_tea");

    const dinner = previews.find((p) => p.name === "Night Market");
    expect(dinner?.kind).toBe("meal");
    expect(dinner?.mealLabel).toBe("dinner");
  });

  it("should_pad_single_digit_start_time_for_window_TC_M3r_34_05", () => {
    const expanded = expandArrangeDayToSlots(
      [
        {
          name: "Old Tower",
          type: "attraction",
          start_time: "9:30",
          duration_min: 90,
          reason: "Iconic",
        },
      ],
      {},
      { transport: "transit" },
    );

    const place = expanded.map((e) => e.preview).find((p) => p.name === "Old Tower");
    expect(place?.window).toBe("09:30–11:00");
  });

  it("should_insert_inter_stop_transit_between_blocks", () => {
    const expanded = expandArrangeDayToSlots(
      [
        {
          name: "A",
          type: "attraction",
          start_time: "10:00",
          duration_min: 60,
          reason: "first",
        },
        {
          name: "B",
          type: "attraction",
          start_time: "12:00",
          duration_min: 60,
          reason: "second",
        },
      ],
      {},
      { transport: "walk" },
    );

    expect(expanded.some((e) => e.slot.kind === "transit")).toBe(true);
    const transit = expanded.find((e) => e.preview.kind === "transit");
    expect(transit?.preview.transportLabel).toMatch(/walk/i);
    expect(transit?.preview.window).toMatch(/min/);
    expect(expanded.filter((e) => e.slot.kind === "place")).toHaveLength(2);
  });

  it("should_not_duplicate_from_origin_when_first_block_has_legs_to_here", () => {
    const expanded = expandArrangeDayToSlots(
      [
        {
          name: "Museum",
          type: "attraction",
          start_time: "10:00",
          duration_min: 90,
          reason: "must see",
          legs_to_here: [{ mode: "metro", duration_min: 25, recommended: true }],
        },
      ],
      {
        from_origin: { transport: "metro", duration_min: 25, depart_time: "09:30" },
      },
      { transit_outcome: "directions" },
    );

    const transitSlots = expanded.filter((e) => e.slot.kind === "transit");
    expect(transitSlots).toHaveLength(1);
  });

  it("should_include_from_origin_and_to_destination_when_present", () => {
    const expanded = expandArrangeDayToSlots(
      [
        {
          name: "Museum",
          type: "attraction",
          start_time: "10:00",
          duration_min: 90,
          reason: "must see",
        },
      ],
      {
        from_origin: { transport: "metro", duration_min: 25, depart_time: "09:30" },
        to_destination: { transport: "taxi", duration_min: 20, depart_time: "11:30" },
      },
      { transport: "transit" },
    );

    expect(expanded[0]?.preview.kind).toBe("transit");
    expect(expanded[0]?.preview.transportLabel).toMatch(/metro/i);
    expect(expanded[expanded.length - 1]?.preview.kind).toBe("transit");
  });

  it("should_use_legs_to_here_instead_of_default_15min", () => {
    const expanded = expandArrangeDayToSlots(
      [
        {
          name: "A",
          type: "attraction",
          start_time: "10:00",
          duration_min: 60,
          reason: "first",
        },
        {
          name: "B",
          type: "attraction",
          start_time: "12:00",
          duration_min: 60,
          reason: "second",
          legs_to_here: [{ mode: "transit", duration_min: 28, recommended: true }],
        },
      ],
      {},
      { transit_outcome: "directions" },
    );

    const transit = expanded.find((e) => e.preview.kind === "transit");
    expect(transit?.slot.kind).toBe("transit");
    if (transit?.slot.kind === "transit") {
      expect(transit.slot.text).toContain("transit");
      expect(transit.slot.text).toContain("28");
      expect(transit.slot.text).not.toContain("15 min");
    }
    expect(transit?.preview.reason).toBe("play.plan.transit_directions");
  });
});
