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

  it("should_keep_latin_slot_when_details_cjk", () => {
    expect(
      preferSlotDisplayName("Museu Nacional do Azulejo", "国家瓷砖博物馆"),
    ).toBe("Museu Nacional do Azulejo");
  });

  it("should_use_details_when_both_cjk", () => {
    expect(preferSlotDisplayName("植物园", "杭州植物园")).toBe("杭州植物园");
  });

  it("should_use_details_when_both_latin", () => {
    expect(preferSlotDisplayName("Tower", "Eiffel Tower")).toBe("Eiffel Tower");
  });

  it("should_keep_slot_when_details_missing", () => {
    expect(preferSlotDisplayName("Museu Nacional do Azulejo")).toBe(
      "Museu Nacional do Azulejo",
    );
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

  it("should_keep_latin_slot_address_when_details_cjk", () => {
    expect(
      preferSlotDisplayAddress("Rua da Madre de Deus 4, Lisboa", "葡萄牙里斯本"),
    ).toBe("Rua da Madre de Deus 4, Lisboa");
  });
});
