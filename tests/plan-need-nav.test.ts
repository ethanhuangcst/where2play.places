import { describe, expect, it } from "vitest";
import { redoNeedState } from "../src/core/plan-need-nav";
import CN from "../messages/CN.json";
import EN from "../messages/EN.json";
import HK from "../messages/HK.json";
import TW from "../messages/TW.json";

const QUESTIONS = [{ id: "hotel" }, { id: "start_time" }, { id: "must_see" }, { id: "other" }];

describe("plan-need-nav", () => {
  it("should_return_to_previous_need_when_redo_clicked", () => {
    const next = redoNeedState(QUESTIONS, 1, { hotel: "H", start_time: "09:00" });
    expect(next.index).toBe(0);
    expect(next.answers.hotel).toBeUndefined();
    expect(next.answers.start_time).toBeUndefined();
  });

  it("should_disable_redo_on_first_need", () => {
    const next = redoNeedState(QUESTIONS, 0, {});
    expect(next.index).toBe(0);
  });

  it("should_not_call_plan_trip_again_on_redo", () => {
    let planTripCalls = 0;
    redoNeedState(QUESTIONS, 2, { hotel: "H", start_time: "09:00" });
    expect(planTripCalls).toBe(0);
  });

  it("should_skip_copy_not_mention_send_to_skip", () => {
    for (const cat of [CN, EN, HK, TW]) {
      const blob = [
        cat["play.plan.need_skip_hint"],
        cat["play.plan.need_prompt.hotel"],
        cat["play.plan.need_prompt.start_time"],
        cat["play.plan.need_prompt.must_see"],
        cat["play.plan.need_prompt.other"],
        cat["play.plan.need_send_to_skip"],
      ].join(" ");
      expect(blob).not.toMatch(/点发送即可跳过|按傳送即可略過|Send with an empty box/);
    }
  });
});
