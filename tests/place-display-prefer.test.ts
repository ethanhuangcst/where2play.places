import { describe, expect, it } from "vitest";
import {
  preferSlotDisplayName,
  preferSlotDisplayAddress,
} from "@/src/ui/place-display-prefer";

describe("preferSlotDisplayName", () => {
  it("should_keep_cjk_slot_when_details_latin", () => {
    expect(
      preferSlotDisplayName("杭州植物园", "Hangzhou Botanical Garden"),
    ).toBe("杭州植物园");
  });

  it("should_use_details_when_both_cjk", () => {
    expect(preferSlotDisplayName("植物园", "杭州植物园")).toBe("杭州植物园");
  });

  it("should_use_details_when_slot_latin", () => {
    expect(preferSlotDisplayName("Tower", "Eiffel Tower")).toBe("Eiffel Tower");
  });
});

describe("preferSlotDisplayAddress", () => {
  it("should_keep_cjk_slot_address_when_details_latin", () => {
    expect(
      preferSlotDisplayAddress(
        "浙江省杭州市西湖区桃源岭1号",
        "China, Zhejiang, Hangzhou",
      ),
    ).toBe("浙江省杭州市西湖区桃源岭1号");
  });
});
