import { describe, expect, it } from "vitest";
import {
  artifactsTipsFromSlice,
  artifactsVisaFromSlice,
  latestFilledStopFromSlice,
  skeletonIsFillable,
  travelTipsPayloadFromSlice,
  VISA_NOTICE_UNAVAILABLE,
  visaNoticeFromSlice,
} from "../src/core/plan-fetch-trip";

describe("artifactsTipsFromSlice (2play-plan-90d)", () => {
  it("should_return_tips_object_when_artifacts_tips_present", () => {
    const tips = artifactsTipsFromSlice({
      artifacts: {
        tips: {
          intro: "Hi",
          iconic_places: ["Tower"],
          transit: "",
          clothing: "",
          safety: "",
          weather: null,
        },
      },
    });
    expect(tips?.intro).toBe("Hi");
    expect(tips?.iconic_places).toEqual(["Tower"]);
  });

  it("should_return_null_when_tips_missing", () => {
    expect(artifactsTipsFromSlice({})).toBeNull();
    expect(artifactsTipsFromSlice({ artifacts: {} })).toBeNull();
    expect(artifactsTipsFromSlice({ artifacts: { visa: {} } })).toBeNull();
  });
});

describe("artifactsVisaFromSlice (2play-plan-94b)", () => {
  it("should_return_visa_when_passport_and_destination_present", () => {
    const visa = artifactsVisaFromSlice({
      artifacts: {
        visa: {
          passport: "CHN",
          destination: "PRT",
          requirement: "visa_required",
          description: "Schengen visa needed.",
        },
      },
    });
    expect(visa).toEqual({
      passport: "CHN",
      destination: "PRT",
      requirement: "visa_required",
      description: "Schengen visa needed.",
    });
  });

  it("should_keep_honest_orizn_detail_fields_and_drop_upgrade_placeholders", () => {
    const visa = artifactsVisaFromSlice({
      artifacts: {
        visa: {
          passport: "CHN",
          destination: "PRT",
          requirement: "visa_required",
          description: "Schengen visa needed.",
          documents: ["Valid passport", "Application form"],
          process: ["Apply at VAC"],
          processing_time: "10–15 working days",
          cost: { upgrade: "Fee details require Pro plan" },
          validity: "Up to 5 years",
          max_stay: "90 days in 180",
          extension: { possible: false, details: "Usually not extendable" },
          last_verified: "2026-05-10T00:00:00.000Z",
          source_url: "https://vistos.mne.gov.pt/",
          embassy: { upgrade: "Embassy info requires Pro plan" },
        },
      },
    });
    expect(visa?.documents).toEqual(["Valid passport", "Application form"]);
    expect(visa?.process).toEqual(["Apply at VAC"]);
    expect(visa?.processing_time).toBe("10–15 working days");
    expect(visa?.cost).toBeUndefined();
    expect(visa?.validity).toBe("Up to 5 years");
    expect(visa?.max_stay).toBe("90 days in 180");
    expect(visa?.extension).toEqual({ possible: false, details: "Usually not extendable" });
    expect(visa?.last_verified).toBe("2026-05-10T00:00:00.000Z");
    expect(visa?.source_url).toBe("https://vistos.mne.gov.pt/");
    expect(visa?.embassy).toBeUndefined();
  });

  it("should_return_null_when_unavailable_or_error_outcome", () => {
    expect(
      artifactsVisaFromSlice({ artifacts: { visa: { unavailable: true, passport: "CHN", destination: "PRT" } } }),
    ).toBeNull();
    expect(
      artifactsVisaFromSlice({
        artifacts: {
          visa: {
            passport: "CHN",
            destination: "PRT",
            outcome: "errors.visa_quota_exceeded",
          },
        },
      }),
    ).toBeNull();
  });

  it("should_return_null_for_same_iso_or_not_applicable", () => {
    expect(
      artifactsVisaFromSlice({
        artifacts: {
          visa: {
            passport: "CHN",
            destination: "CHN",
            requirement: "not_applicable",
            description: "Home.",
          },
        },
      }),
    ).toBeNull();
    expect(
      artifactsVisaFromSlice({
        artifacts: {
          visa: {
            passport: "CHN",
            destination: "CHN",
            requirement: "visa_free",
            visa_free_days: 90,
          },
        },
      }),
    ).toBeNull();
    expect(
      travelTipsPayloadFromSlice({
        artifacts: {
          tips: { intro: "Hi" },
          visa: { passport: "CHN", destination: "CHN", requirement: "not_applicable" },
        },
      })?.visa_notice,
    ).toBeUndefined();
  });
});

describe("travelTipsPayloadFromSlice (2play-plan-94b)", () => {
  it("should_merge_visa_onto_tips_without_using_tips_as_visa_policy", () => {
    const payload = travelTipsPayloadFromSlice({
      artifacts: {
        tips: { intro: "Hilly port." },
        visa: {
          passport: "CHN",
          destination: "PRT",
          requirement: "visa_required",
          description: "Apply before travel.",
        },
      },
    });
    expect(payload?.intro).toBe("Hilly port.");
    expect(payload?.visa).toMatchObject({ passport: "CHN", destination: "PRT" });
    expect(payload?.visa_notice).toBeUndefined();
  });

  it("should_attach_unavailable_notice_when_visa_outcome_is_an_error", () => {
    const slice = {
      artifacts: {
        tips: { intro: "Hilly port." },
        visa: {
          unavailable: true,
          outcome: "errors.visa_quota_exceeded",
          requirement: "visa_free",
          visa_free_days: 90,
          description: "Invented",
        },
      },
    };
    expect(artifactsVisaFromSlice(slice)).toBeNull();
    expect(visaNoticeFromSlice(slice)).toEqual({ key: VISA_NOTICE_UNAVAILABLE });
    const payload = travelTipsPayloadFromSlice(slice);
    expect(payload?.visa).toBeUndefined();
    expect(payload?.visa_notice).toEqual({ key: VISA_NOTICE_UNAVAILABLE });
    expect(payload?.intro).toBe("Hilly port.");
    expect(JSON.stringify(payload?.visa_notice)).not.toContain("visa_free");
  });

  it("should_return_null_notice_when_destination_country_was_never_written", () => {
    expect(visaNoticeFromSlice({ artifacts: { tips: { intro: "Hi" } } })).toBeNull();
    const payload = travelTipsPayloadFromSlice({ artifacts: { tips: { intro: "Hi" } } });
    expect(payload?.visa_notice).toBeUndefined();
    expect(payload?.visa).toBeUndefined();
  });
});

describe("latestFilledStopFromSlice (MVP-T5 TD-6)", () => {
  it("should_read_latest_object_shape_from_http_plan_next_stop_write", () => {
    const latest = latestFilledStopFromSlice({
      filled: {
        stop: { name: "Torre de Belém", kind: "attraction" },
        slot: { start: "09:30", end: "11:00" },
        legs: [{ mode: "walk", duration_min: 12 }],
      },
    });
    expect(latest?.stop?.name).toBe("Torre de Belém");
    expect(latest?.slot?.end).toBe("11:00");
    expect(latest?.legs?.[0]?.duration_min).toBe(12);
  });

  it("should_read_last_entry_from_filled_stops_array", () => {
    const latest = latestFilledStopFromSlice({
      filled: {
        stops: [
          { stop: { name: "Hotel", kind: "stay" }, slot: { start: "09:00", end: "09:00" } },
          {
            stop: { name: "Tower", kind: "attraction" },
            slot: { start: "10:00", end: "11:00" },
            legs: [{ mode: "transit", duration_min: 20 }],
          },
        ],
      },
    });
    expect(latest?.stop?.name).toBe("Tower");
    expect(latest?.legs?.[0]?.duration_min).toBe(20);
  });
});

describe("skeletonIsFillable (TC-M22-SIGN-UI)", () => {
  it("should_reject_stay_only_and_stay_plus_meal_without_attraction", () => {
    expect(
      skeletonIsFillable({
        days: [{ day_index: 1, stops: [{ name: "Hotel", kind: "stay" }] }],
      }),
    ).toBe(false);
    expect(
      skeletonIsFillable({
        days: [
          {
            day_index: 1,
            stops: [
              { name: "Hotel", kind: "stay" },
              { name: "lunch", kind: "meal", meal_slot: "lunch" },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it("should_accept_day_with_legacy_place_kind", () => {
    expect(
      skeletonIsFillable({
        days: [{ day_index: 1, stops: [{ name: "Tower", kind: "place" }] }],
      }),
    ).toBe(true);
  });

  it("should_accept_day_with_attraction_and_meal_slots", () => {
    expect(
      skeletonIsFillable({
        days: [
          {
            day_index: 1,
            stops: [
              { name: "Hotel", kind: "stay" },
              { name: "贝伦塔", kind: "attraction" },
              { name: "lunch", kind: "meal", meal_slot: "lunch" },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
