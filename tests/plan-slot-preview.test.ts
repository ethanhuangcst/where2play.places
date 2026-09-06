import { describe, expect, it } from "vitest";
import { formatSlotPreviewLine, previewForTransitLeg } from "../src/core/plan-slot-preview";

const catalog: Record<string, string> = {
  "play.plan.preview_place": "正在加入行程：{name}，预计游览时间：{window}",
  "play.plan.preview_transit": "正在安排下一段行程的交通：{label}，预计耗时：{duration}",
  "play.plan.preview_meal": "正在安排{meal}，推荐：{name}，预计用餐时间：{window}",
  "play.plan.meal_slot_lunch": "午餐",
  "play.plan.meal_slot_dinner": "晚餐",
  "play.plan.meal_slot_afternoon_tea": "下午茶",
  "play.plan.transit.mode.walk": "步行",
  "play.plan.transit.mode.transit": "公共交通",
  "play.plan.transit.mode.drive": "驾车",
  "play.plan.transit.line": "{mode} · 约 {minutes} 分钟",
  "play.plan.transit.or": "或",
  "play.plan.transit.options_join": "，{or} ",
  "play.plan.transit_directions": "来自地图路线的耗时",
  "play.plan.preview_reason_skeleton": "行程骨架推荐",
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

describe("formatSlotPreviewLine (24-P0-ui-A)", () => {
  it("should_omit_reason_fields_for_place_transit_meal", () => {
    const place = formatSlotPreviewLine(
      { kind: "place", name: "圣若热城堡", reason: "行程骨架推荐", window: "60分钟" },
      t,
    );
    expect(place).toBe("正在加入行程：圣若热城堡，预计游览时间：60分钟");
    expect(place).not.toMatch(/原因/);

    const transit = formatSlotPreviewLine(
      {
        kind: "transit",
        name: "圣卢西亚观景台",
        reason: "来自地图路线的耗时",
        window: "~8 min",
        transportLabel: "公共交通 · 约 8 分钟",
      },
      t,
    );
    expect(transit).toBe("正在安排下一段行程的交通：公共交通 · 约 8 分钟，预计耗时：~8 min");
    expect(transit).not.toMatch(/原因/);

    const meal = formatSlotPreviewLine(
      {
        kind: "meal",
        name: "午餐",
        reason: "行程骨架推荐",
        window: "60分钟",
        mealLabel: "lunch",
      },
      t,
    );
    expect(meal).toBe("正在安排午餐，推荐：…，预计用餐时间：60分钟");

    const mealVenue = formatSlotPreviewLine(
      {
        kind: "meal",
        name: "Comidas de Santiago",
        window: "12:00–13:00",
        mealLabel: "lunch",
      },
      t,
    );
    expect(mealVenue).toBe(
      "正在安排午餐，推荐：Comidas de Santiago，预计用餐时间：12:00–13:00",
    );
    expect(mealVenue).not.toMatch(/原因/);
  });

  it("should_build_transit_preview_without_exposing_reason_in_line", () => {
    const preview = previewForTransitLeg(
      "Castle",
      [
        { mode: "transit", duration_min: 8, recommended: true },
        { mode: "walk", duration_min: 8 },
      ],
      t,
    );
    const line = formatSlotPreviewLine(preview, t);
    expect(line).not.toMatch(/原因|Why/);
    expect(line).toContain("预计耗时");
  });
});
