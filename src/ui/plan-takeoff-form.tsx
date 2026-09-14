"use client";

import { useEffect, useRef } from "react";
import {
  BUDGET_OPTION_KEYS,
  budgetOptionLabel,
  normalizeBudgetKey,
} from "@/src/core/plan-budget";
import {
  TRANSIT_OPTION_KEYS,
  normalizeTransitKey,
  transitOptionLabel,
} from "@/src/core/plan-transit";
import { formatTripTypeDisplay, tripTypeStorageValue } from "@/src/core/plan-intake";
import { useT } from "@/src/i18n/use-t";
import { PlanCombo } from "@/src/ui/plan-combo";

const TRIP_TYPE_PRESET_KEYS = [
  "play.plan.trip_type.couple_romance",
  "play.plan.trip_type.family_kids",
  "play.plan.trip_type.food_checkin",
  "play.plan.trip_type.family_vacation",
] as const;

const PACE_KEYS = ["tight", "medium", "relaxed"] as const;

export type TakeoffFieldErrors = Partial<
  Record<
    | "destination"
    | "days"
    | "startDate"
    | "partySize"
    | "budget"
    | "tripType"
    | "pace"
    | "transit"
    | "startTime"
    | "origin"
    | "other",
    string
  >
>;

export type OriginOverlayCandidate = {
  name: string;
  lat?: number;
  lng?: number;
  provider?: string;
  native_id?: string;
};

export type OriginOverlayState =
  | null
  | { kind: "candidates"; query: string; destination: string; cards: OriginOverlayCandidate[] }
  | { kind: "not_found"; query: string; destination: string };

type Props = {
  destination: string;
  startDate: string;
  days: string;
  partySize: string;
  budget: string;
  tripType: string;
  pace: string;
  transit: string;
  startTime: string;
  origin: string;
  other: string;
  destVerifiedLabel: string | null;
  fieldErrors: TakeoffFieldErrors;
  originOverlay: OriginOverlayState;
  /** When true, focus the origin field (e.g. after「换一个名称」). */
  focusOriginToken?: number;
  submitEnabled: boolean;
  onDestinationChange: (v: string) => void;
  onDestinationBlur: () => void;
  onStartDateChange: (v: string) => void;
  onDaysChange: (v: string) => void;
  onPartySizeChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onTripTypeChange: (v: string) => void;
  onPaceChange: (v: string) => void;
  onTransitChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onOriginChange: (v: string) => void;
  /** Prefer the live input value so blur verification is not lost to stale state. */
  onOriginBlur: (value: string) => void;
  onOtherChange: (v: string) => void;
  onOriginPick: (index: number) => void;
  onOriginRetry: () => void;
  onOriginSkip: () => void;
  onSubmit: (e: React.FormEvent) => void;
  /** ADR-064 Option A submit confirm sheet. */
  submitConfirmOpen?: boolean;
  onSubmitConfirmCancel?: () => void;
  onSubmitConfirmOk?: () => void;
  disabled?: boolean;
};

export function PlanTakeoffForm({
  destination,
  startDate,
  days,
  partySize,
  budget,
  tripType,
  pace,
  transit,
  startTime,
  origin,
  other,
  destVerifiedLabel,
  fieldErrors,
  originOverlay,
  focusOriginToken = 0,
  submitEnabled,
  disabled,
  onDestinationChange,
  onDestinationBlur,
  onStartDateChange,
  onDaysChange,
  onPartySizeChange,
  onBudgetChange,
  onTripTypeChange,
  onPaceChange,
  onTransitChange,
  onStartTimeChange,
  onOriginChange,
  onOriginBlur,
  onOtherChange,
  onOriginPick,
  onOriginRetry,
  onOriginSkip,
  onSubmit,
  submitConfirmOpen = false,
  onSubmitConfirmCancel,
  onSubmitConfirmOk,
}: Props) {
  const t = useT();
  const originRef = useRef<HTMLInputElement>(null);
  const originLiveRef = useRef(origin);
  originLiveRef.current = origin;
  const budgetValue = normalizeBudgetKey(budget) || budget;
  const transitValue = normalizeTransitKey(transit) || transit;
  const tripTypePresets = TRIP_TYPE_PRESET_KEYS.map((key) => t(key));
  const tripTypeValue =
    formatTripTypeDisplay(tripType, t) || t("play.plan.trip_type.couple_romance");

  const budgetLabel = budgetOptionLabel(normalizeBudgetKey(budget) || "mid", t);
  const paceLabel = t(`play.plan.pace.${pace}`);
  const transitLabel = t(`play.plan.transit.${transitValue}`);
  const confirmOriginLine = origin.trim()
    ? (startTime.trim() ? `${origin.trim()} · ${startTime.trim()}` : origin.trim())
    : (startTime.trim() ? startTime.trim() : "—");

  useEffect(() => {
    if (!focusOriginToken) return;
    const id = window.setTimeout(() => {
      const el = originRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusOriginToken]);

  return (
    <section
      className={`panel planner-card${disabled ? " is-dimmed" : ""}`}
      aria-label={t("play.plan.form_aria")}
      aria-disabled={disabled || undefined}
    >
      <div className="panel__body">
        <form
          className="plan-form"
          id="plan-form"
          data-testid="plan-form"
          noValidate
          onSubmit={onSubmit}
        >
          <div className="plan-takeoff plan-takeoff--11" data-testid="plan-takeoff-11">
            <div className="plan-takeoff__grid">
              <div className="plan-takeoff__row plan-takeoff__row--1" data-testid="plan-takeoff-row-1">
                <div className={`field${fieldErrors.destination ? " is-invalid" : ""}`} data-field="dest">
                  <label htmlFor="dest" className="is-required">
                    {t("play.plan.destination")}
                  </label>
                  <input
                    id="dest"
                    name="dest"
                    required
                    aria-required="true"
                    data-testid="plan-dest"
                    placeholder={t("play.plan.destination_ph")}
                    value={destination}
                    disabled={disabled}
                    onChange={(e) => onDestinationChange(e.target.value)}
                    onBlur={onDestinationBlur}
                  />
                  {destVerifiedLabel ? (
                    <p className="plan-takeoff__verified" data-testid="plan-dest-verified">
                      {destVerifiedLabel}
                    </p>
                  ) : null}
                  <p className="field-error" role="alert" hidden={!fieldErrors.destination}>
                    {fieldErrors.destination ? t(fieldErrors.destination) : ""}
                  </p>
                </div>

                <div className={`field${fieldErrors.startDate ? " is-invalid" : ""}`} data-field="start_date">
                  <label htmlFor="start_date" className="is-required">
                    {t("play.plan.start_day")}
                  </label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    required
                    aria-required="true"
                    data-testid="plan-start-date"
                    value={startDate}
                    disabled={disabled}
                    onChange={(e) => onStartDateChange(e.target.value)}
                  />
                  <p className="field-error" role="alert" hidden={!fieldErrors.startDate}>
                    {fieldErrors.startDate ? t(fieldErrors.startDate) : ""}
                  </p>
                </div>

                <div className={`field${fieldErrors.tripType ? " is-invalid" : ""}`} data-field="trip_type">
                  <label htmlFor="trip_type" className="is-required">
                    {t("play.plan.trip_type_short")}
                  </label>
                  <PlanCombo
                    id="trip_type"
                    name="trip_type"
                    value={tripTypeValue}
                    options={tripTypePresets}
                    onChange={(v) => onTripTypeChange(tripTypeStorageValue(v, t))}
                    toggleLabel={t("play.plan.trip_type_short")}
                    disabled={disabled}
                    required
                    testId="plan-trip-type"
                  />
                </div>

                <div className={`field${fieldErrors.days ? " is-invalid" : ""}`} data-field="days">
                  <label htmlFor="days" className="is-required">
                    {t("play.plan.trip_days")}
                  </label>
                  <input
                    id="days"
                    name="days"
                    type="number"
                    min={1}
                    max={14}
                    required
                    aria-required="true"
                    inputMode="numeric"
                    data-testid="plan-days"
                    value={days}
                    disabled={disabled}
                    onChange={(e) => onDaysChange(e.target.value)}
                  />
                </div>

                <div className={`field${fieldErrors.partySize ? " is-invalid" : ""}`} data-field="party">
                  <label htmlFor="party" className="is-required">
                    {t("play.plan.party_travel")}
                  </label>
                  <input
                    id="party"
                    name="party"
                    type="number"
                    min={1}
                    max={20}
                    required
                    aria-required="true"
                    inputMode="numeric"
                    data-testid="plan-party"
                    value={partySize}
                    disabled={disabled}
                    onChange={(e) => onPartySizeChange(e.target.value)}
                  />
                </div>

                <div className={`field${fieldErrors.budget ? " is-invalid" : ""}`} data-field="budget">
                  <label htmlFor="budget" className="is-required">
                    {t("play.plan.budget")}
                  </label>
                  <select
                    id="budget"
                    name="budget"
                    required
                    aria-required="true"
                    data-testid="plan-budget"
                    value={budgetValue}
                    disabled={disabled}
                    onChange={(e) => onBudgetChange(e.target.value)}
                  >
                    {BUDGET_OPTION_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {budgetOptionLabel(key, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`field${fieldErrors.pace ? " is-invalid" : ""}`} data-field="pace">
                  <label htmlFor="pace" className="is-required">
                    {t("play.plan.pace")}
                  </label>
                  <select
                    id="pace"
                    name="pace"
                    required
                    aria-required="true"
                    data-testid="plan-pace"
                    value={pace}
                    disabled={disabled}
                    onChange={(e) => onPaceChange(e.target.value)}
                  >
                    {PACE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`play.plan.pace.${key}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="plan-takeoff__row plan-takeoff__row--2" data-testid="plan-takeoff-row-2">
                <div className={`field${fieldErrors.origin ? " is-invalid" : ""}`} data-field="origin">
                  <label htmlFor="origin">{t("play.plan.origin")}</label>
                  <input
                    ref={originRef}
                    id="origin"
                    name="origin"
                    data-testid="plan-origin"
                    placeholder={t("play.plan.origin_ph")}
                    value={origin}
                    disabled={disabled}
                    onChange={(e) => {
                      originLiveRef.current = e.target.value;
                      onOriginChange(e.target.value);
                    }}
                    onBlur={() => onOriginBlur(originLiveRef.current)}
                  />
                </div>

                <div className={`field${fieldErrors.startTime ? " is-invalid" : ""}`} data-field="start_time">
                  <label htmlFor="start_time">{t("play.plan.start_time")}</label>
                  <input
                    id="start_time"
                    name="start_time"
                    type="time"
                    data-testid="plan-start-time"
                    value={startTime}
                    disabled={disabled}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                  />
                </div>

                <div className={`field${fieldErrors.transit ? " is-invalid" : ""}`} data-field="transit">
                  <label htmlFor="transit" className="is-required">
                    {t("play.plan.transit_short")}
                  </label>
                  <select
                    id="transit"
                    name="transit"
                    required
                    aria-required="true"
                    data-testid="plan-transit"
                    value={transitValue}
                    disabled={disabled}
                    onChange={(e) => onTransitChange(e.target.value)}
                  >
                    {TRANSIT_OPTION_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {transitOptionLabel(key, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={`field field--other-span${fieldErrors.other ? " is-invalid" : ""}`}
                  data-field="other"
                >
                  <label htmlFor="other">{t("play.plan.other")}</label>
                  <input
                    id="other"
                    name="other"
                    data-testid="plan-other"
                    placeholder={t("play.plan.other_ph")}
                    value={other}
                    disabled={disabled}
                    onChange={(e) => onOtherChange(e.target.value)}
                  />
                </div>

                <div className="plan-takeoff__actions">
                  <button
                    className={`btn plan-takeoff__cta${!submitEnabled ? " is-disabled" : ""}`}
                    type="submit"
                    data-testid="plan-submit"
                    id="plan-submit-host"
                    disabled={disabled || !submitEnabled}
                  >
                    {t("play.plan.plan_cta")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {originOverlay ? (
        <div
          className="takeoff-origin-overlay"
          data-testid="plan-origin-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-origin-overlay-title"
        >
          <div className="takeoff-origin-sheet">
            <h2 id="plan-origin-overlay-title">{t("play.plan.origin_overlay_title")}</h2>
            {originOverlay.kind === "candidates" ? (
              <>
                <p data-testid="plan-origin-candidates">
                  {t("play.plan.intake_origin_candidates", {
                    destination: originOverlay.destination,
                    query: originOverlay.query,
                  })}
                </p>
                <ul className="takeoff-origin-sheet__list">
                  {originOverlay.cards.map((card, i) => (
                    <li key={`${card.name}-${i}`}>
                      <button type="button" onClick={() => onOriginPick(i)}>
                        {card.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p data-testid="plan-origin-not-found">
                {t("play.plan.intake_origin_not_found", {
                  destination: originOverlay.destination,
                  query: originOverlay.query,
                })}
              </p>
            )}
            <div className="takeoff-origin-sheet__actions">
              <button
                type="button"
                className="btn"
                data-testid="plan-origin-retry"
                onClick={onOriginRetry}
              >
                {t("play.plan.intake_origin_retry")}
              </button>
              <button
                type="button"
                className="btn"
                data-testid="plan-origin-skip"
                onClick={onOriginSkip}
              >
                {t("play.plan.intake_origin_skip")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {submitConfirmOpen && !originOverlay ? (
        <div
          className="takeoff-origin-overlay"
          data-testid="plan-submit-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-submit-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onSubmitConfirmCancel?.();
          }}
        >
          <div className="takeoff-origin-sheet">
            <h2 id="plan-submit-confirm-title">{t("play.plan.submit_confirm_title")}</h2>
            <p data-testid="plan-submit-confirm-body">{t("play.plan.submit_confirm_body")}</p>
            <dl className="takeoff-confirm-summary" data-testid="plan-submit-confirm-summary">
              <div>
                <dt>{t("play.plan.submit_confirm_dest")}</dt>
                <dd>{destVerifiedLabel || destination}</dd>
              </div>
              <div>
                <dt>{t("play.plan.submit_confirm_when")}</dt>
                <dd>
                  {t("play.plan.submit_confirm_when_value", {
                    date: startDate,
                    days,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t("play.plan.submit_confirm_party")}</dt>
                <dd>
                  {t("play.plan.submit_confirm_party_value", {
                    tripType: tripTypeValue,
                    party: partySize,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t("play.plan.submit_confirm_prefs")}</dt>
                <dd>
                  {budgetLabel} · {paceLabel} · {transitLabel}
                </dd>
              </div>
              <div>
                <dt>{t("play.plan.submit_confirm_origin")}</dt>
                <dd>{confirmOriginLine}</dd>
              </div>
            </dl>
            <div className="takeoff-origin-sheet__actions">
              <button
                type="button"
                className="btn btn-quiet"
                data-testid="plan-submit-confirm-cancel"
                onClick={() => onSubmitConfirmCancel?.()}
              >
                {t("play.plan.submit_confirm_cancel")}
              </button>
              <button
                type="button"
                className="btn"
                data-testid="plan-submit-confirm-ok"
                onClick={() => onSubmitConfirmOk?.()}
              >
                {t("play.plan.submit_confirm_ok")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}