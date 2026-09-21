import { describe, expect, it } from "vitest";
import { visaTipsDisplay } from "../src/core/plan-visa-display";

describe("visaTipsDisplay (2play-plan-94b)", () => {
  it("should_format_link_from_artifacts_visa_not_tips_prose", () => {
    const display = visaTipsDisplay(
      {
        passport: "CHN",
        destination: "PRT",
        requirement: "visa_required",
        description: "Apply for Schengen before travel.",
      },
      "CN",
    );
    expect(display?.label).toBe("中国护照 · 葡萄牙 · 需要签证");
    expect(display?.title).toBe("需要签证");
    expect(display?.body).toBe("Apply for Schengen before travel.");
    expect(display?.source).toBe("数据来源 · Orizn Visa");
  });

  it("should_interpolate_visa_free_days", () => {
    const display = visaTipsDisplay(
      {
        passport: "CHN",
        destination: "SGP",
        requirement: "visa_free",
        visa_free_days: 30,
        description: "Up to 30 days.",
      },
      "EN",
    );
    expect(display?.label).toMatch(/China passport/i);
    expect(display?.label).toMatch(/30/);
    expect(display?.title).toContain("30");
  });

  it("should_return_null_when_visa_missing", () => {
    expect(visaTipsDisplay(null, "EN")).toBeNull();
  });

  it("should_return_null_for_same_iso_or_not_applicable", () => {
    expect(
      visaTipsDisplay(
        { passport: "CHN", destination: "CHN", requirement: "visa_free", visa_free_days: 90 },
        "EN",
      ),
    ).toBeNull();
    expect(
      visaTipsDisplay(
        {
          passport: "CHN",
          destination: "PRT",
          requirement: "not_applicable",
          description: "Home country.",
        },
        "EN",
      ),
    ).toBeNull();
  });

  it("should_show_special_requirement_for_greater_china_pair", () => {
    const display = visaTipsDisplay(
      {
        passport: "CHN",
        destination: "HKG",
        requirement: "special",
        description: "Exit-entry Permit required.",
      },
      "CN",
    );
    expect(display?.title).toBe("特殊通行证件");
    expect(display?.label).toContain("特殊通行证件");
    expect(display?.body).toContain("Exit-entry Permit");
  });

  it("should_surface_documents_process_and_facts_from_honest_fields", () => {
    const display = visaTipsDisplay(
      {
        passport: "CHN",
        destination: "PRT",
        requirement: "visa_required",
        description: "Apply for Schengen before travel.",
        documents: ["Valid passport"],
        process: ["Book VAC appointment"],
        processing_time: "10–15 working days",
        validity: "Up to 5 years",
        max_stay: "90 days in 180",
        extension: { possible: false, details: "Usually not extendable" },
        last_verified: "2026-05-10T00:00:00.000Z",
        source_url: "https://vistos.mne.gov.pt/en/",
      },
      "CN",
    );
    expect(display?.lists.map((l) => l.key)).toEqual(["documents", "process"]);
    expect(display?.lists[0]?.items).toEqual(["Valid passport"]);
    expect(display?.facts.map((f) => f.key)).toEqual(
      expect.arrayContaining(["processing_time", "validity", "max_stay", "extension"]),
    );
    expect(display?.facts.find((f) => f.key === "processing_time")?.value).toBe("10–15 working days");
    expect(display?.facts.find((f) => f.key === "extension")?.value).toBe(
      "通常不可延期 — Usually not extendable",
    );
    expect(display?.sourceHost).toBe("vistos.mne.gov.pt");
    expect(display?.sourceHref).toBe("https://vistos.mne.gov.pt/en/");
    expect(display?.verified).toBe("核对至 2026-05-10");
  });

  it("should_omit_upgrade_and_empty_vendor_fields", () => {
    const display = visaTipsDisplay(
      {
        passport: "CHN",
        destination: "PRT",
        requirement: "visa_required",
        description: "Apply for Schengen before travel.",
        documents: [],
        cost: undefined,
      },
      "EN",
    );
    expect(display?.lists).toEqual([]);
    expect(display?.facts.find((f) => f.key === "cost")).toBeUndefined();
  });

  it("should_not_repeat_extension_phrase_when_details_already_contains_it", () => {
    const display = visaTipsDisplay(
      {
        passport: "CHN",
        destination: "PRT",
        requirement: "visa_required",
        extension: { possible: false, details: "通常不可延期。需要新的申请。" },
      },
      "CN",
    );
    expect(display?.facts.find((f) => f.key === "extension")?.value).toBe(
      "通常不可延期。需要新的申请。",
    );
  });
});
