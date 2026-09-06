import { describe, expect, it } from "vitest";
import {
  buildDayFillRoute,
  buildFillRouteDays,
  buildSkeletonRouteDays,
  parseTransitModes,
} from "../src/core/format-fill-timeline";
import { mealPreviewRecommendName } from "../src/core/meal-slot-label";
import type { ItineraryDayDto } from "../src/core/itinerary-types";

const catalog: Record<string, string> = {
  "play.plan.timeline_origin": "{idx} 行程起点：{name}",
  "play.plan.timeline_depart":
    "{time} 从 {from} 出发，前往 {to}。{transit}",
  "play.plan.timeline_depart_next": "{time} 出发前往下一站",
  "play.plan.timeline_stop":
    "{idx} [{kind}] {name}，到达：{arrive}，停留：{dwell}分钟",
  "play.plan.kind_attraction": "景点",
  "play.plan.kind_stay": "住宿",
  "play.plan.meal_slot_lunch": "午餐",
  "play.plan.meal_slot_dinner": "晚餐",
  "play.plan.origin_stop": "起点 · {name}",
  "play.plan.transit.or": "或",
  "play.plan.transit.options_join": "，{or} ",
};

const t = (key: string, vars?: Record<string, string>) => {
  let text = catalog[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
};

const sampleDay: ItineraryDayDto = {
  dayIndex: 1,
  highlights: { label: "", title: "", theme: "阿尔法玛与历史中心浪漫漫步", tags: [] },
  slots: [
    {
      kind: "place",
      start: "07:00",
      end: "07:00",
      placeKind: "stay",
      name: "起点 · Hyatt Regency Lisbon",
      summary: "",
    },
    {
      kind: "transit",
      start: "07:00",
      text: "公共交通 · 约 44 分钟，或 驾车 · 约 31 分钟",
    },
    {
      kind: "place",
      start: "07:45",
      end: "08:45",
      placeKind: "attraction",
      name: "圣若热城堡",
      summary: "",
    },
    {
      kind: "transit",
      start: "08:45",
      text: "公共交通 · 约 8 分钟",
    },
    {
      kind: "place",
      start: "12:00",
      end: "13:00",
      placeKind: "meal",
      name: "Comidas de Santiago",
      summary: "",
    },
  ],
};

describe("buildDayFillRoute (24-P0-ui-B)", () => {
  it("should_label_dinner_meal_slot_not_lunch (24-P0-ui-C-fix)", () => {
    const day: ItineraryDayDto = {
      dayIndex: 1,
      highlights: { label: "", title: "Day 1", tags: [] },
      slots: [
        {
          kind: "place",
          start: "19:00",
          end: "20:30",
          placeKind: "meal",
          mealSlot: "dinner",
          name: "Maat Café",
          summary: "",
        },
      ],
    };
    const route = buildDayFillRoute(day, t, { includeTransit: true });
    const meal = route.legs.find((l) => l.kind === "meal");
    expect(meal && "kindLabel" in meal ? meal.kindLabel : "").toBe("晚餐");
  });

  it("should_include_transit_and_meta_when_includeTransit", () => {
    const route = buildDayFillRoute(sampleDay, t, { includeTransit: true });
    expect(route.theme).toBe("阿尔法玛与历史中心浪漫漫步");
    expect(route.legs[0]).toEqual({
      kind: "origin",
      idx: "00",
      name: "Hyatt Regency Lisbon",
    });
    expect(route.legs[1]?.kind).toBe("transit");
    if (route.legs[1]?.kind === "transit") {
      expect(route.legs[1].depart).toBe("07:00");
      expect(route.legs[1].modes[0]?.label).toContain("公共交通");
      expect(route.legs[1].modes[0]?.duration).toBe("44′");
    }
    expect(route.legs[2]).toMatchObject({
      kind: "stop",
      idx: "01",
      kindLabel: "景点",
      name: "圣若热城堡",
      arrive: "07:45",
      dwellMin: 60,
    });
    expect(route.legs[4]).toMatchObject({
      kind: "meal",
      idx: "02",
      name: "Comidas de Santiago",
      arrive: "12:00",
      dwellMin: 60,
    });
  });

  it("should_omit_transit_and_times_when_skeleton", () => {
    const route = buildDayFillRoute(sampleDay, t, { includeTransit: false });
    expect(route.legs.every((l) => l.kind !== "transit")).toBe(true);
    const stop = route.legs.find((l) => l.kind === "stop");
    expect(stop && "arrive" in stop ? stop.arrive : undefined).toBeUndefined();
  });
});

describe("buildSkeletonRouteDays", () => {
  it("should_map_preview_stops_without_transit", () => {
    const days = buildSkeletonRouteDays(
      [
        {
          dayIndex: 1,
          theme: "西区艺术与观景浪漫日",
          stops: [
            { name: "Hyatt Regency Lisbon", kind: "stay_origin" },
            { name: "罗卡角", kind: "attraction" },
            { name: "Nem que a vaca tussa", kind: "meal", mealSlot: "lunch" },
          ],
        },
      ],
      t,
    );
    expect(days[0]!.legs).toHaveLength(3);
    expect(days[0]!.legs.map((l) => l.kind)).toEqual(["origin", "stop", "meal"]);
  });
});

describe("parseTransitModes", () => {
  it("should_split_or_joined_legs", () => {
    const modes = parseTransitModes("公共交通 · 约 44 分钟，或 驾车 · 约 31 分钟", t);
    expect(modes).toHaveLength(2);
    expect(modes[0]).toMatchObject({ label: "公共交通", duration: "44′", recommended: true });
    expect(modes[1]).toMatchObject({ label: "驾车", duration: "31′" });
  });
});

describe("buildFillRouteDays", () => {
  it("should_skip_days_without_places", () => {
    expect(
      buildFillRouteDays({ days: [{ dayIndex: 1, highlights: { label: "", title: "", tags: [] }, slots: [] }] }, t),
    ).toEqual([]);
  });
});

describe("mealPreviewRecommendName", () => {
  it("should_not_recommend_slot_id_or_meal_label", () => {
    expect(mealPreviewRecommendName("lunch", "午餐")).toBe("…");
    expect(mealPreviewRecommendName("午餐", "午餐")).toBe("…");
    expect(mealPreviewRecommendName("Comidas de Santiago", "午餐")).toBe(
      "Comidas de Santiago",
    );
  });
});
