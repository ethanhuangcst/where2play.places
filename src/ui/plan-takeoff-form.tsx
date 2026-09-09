"use client";

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
    "destination" | "days" | "startDate" | "partySize" | "budget" | "tripType" | "pace" | "transit",
    string
  >
>;

type Props = {
  destination: string;
  startDate: string;
  days: string;
  partySize: string;
  budget: string;
  tripType: string;
  pace: string;
  transit: string;
  fieldErrors: TakeoffFieldErrors;
  onDestinationChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onDaysChange: (v: string) => void;
  onPartySizeChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onTripTypeChange: (v: string) => void;
  onPaceChange: (v: string) => void;
  onTransitChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
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
  fieldErrors,
  disabled,
  onDestinationChange,
  onStartDateChange,
  onDaysChange,
  onPartySizeChange,
  onBudgetChange,
  onTripTypeChange,
  onPaceChange,
  onTransitChange,
  onSubmit,
}: Props) {
  const t = useT();
  const budgetValue = normalizeBudgetKey(budget) || budget;
  const transitValue = normalizeTransitKey(transit) || transit;
  const tripTypePresets = TRIP_TYPE_PRESET_KEYS.map((key) => t(key));
  const tripTypeValue =
    formatTripTypeDisplay(tripType, t) || t("play.plan.trip_type.couple_romance");

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
          <div className="plan-takeoff">
            <div className="plan-takeoff__col plan-takeoff__col--core">
              <div className={`field${fieldErrors.destination ? " is-invalid" : ""}`} data-field="dest">
                <label htmlFor="dest">{t("play.plan.destination")}</label>
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
                />
                <p className="field-error" role="alert" hidden={!fieldErrors.destination}>
                  {fieldErrors.destination ? t(fieldErrors.destination) : ""}
                </p>
              </div>
              <div className={`field${fieldErrors.startDate ? " is-invalid" : ""}`} data-field="start_date">
                <label htmlFor="start_date">{t("play.plan.start_day")}</label>
                <div className="plan-takeoff__cluster">
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
                  <div className={`field${fieldErrors.days ? " is-invalid" : ""}`} data-field="days">
                    <label htmlFor="days">{t("play.plan.trip_days")}</label>
                    <input
                      id="days"
                      name="days"
                      type="number"
                      min={1}
                      max={14}
                      required
                      aria-required="true"
                      data-testid="plan-days"
                      value={days}
                      disabled={disabled}
                      onChange={(e) => onDaysChange(e.target.value)}
                    />
                  </div>
                  <div className={`field${fieldErrors.partySize ? " is-invalid" : ""}`} data-field="party">
                    <label htmlFor="party">{t("play.plan.party_travel")}</label>
                    <input
                      id="party"
                      name="party"
                      type="number"
                      min={1}
                      max={20}
                      required
                      aria-required="true"
                      data-testid="plan-party"
                      value={partySize}
                      disabled={disabled}
                      onChange={(e) => onPartySizeChange(e.target.value)}
                    />
                  </div>
                </div>
                <p className="field-error" role="alert" hidden={!fieldErrors.startDate && !fieldErrors.days}>
                  {fieldErrors.startDate
                    ? t(fieldErrors.startDate)
                    : fieldErrors.days
                      ? t(fieldErrors.days)
                      : ""}
                </p>
              </div>
            </div>

            <div className="plan-takeoff__col plan-takeoff__col--prefs">
              <div className={`field${fieldErrors.tripType ? " is-invalid" : ""}`} data-field="trip_type">
                <label htmlFor="trip_type">{t("play.plan.trip_type_short")}</label>
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
              <div className={`field${fieldErrors.budget ? " is-invalid" : ""}`} data-field="budget">
                <label htmlFor="budget">{t("play.plan.budget")}</label>
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
                <label htmlFor="pace">{t("play.plan.pace")}</label>
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
              <div className={`field${fieldErrors.transit ? " is-invalid" : ""}`} data-field="transit">
                <label htmlFor="transit">{t("play.plan.transit_short")}</label>
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
            </div>

            <div className="plan-takeoff__actions">
              <label className="sr-only" htmlFor="plan-submit-host">
                {t("play.plan.plan_cta")}
              </label>
              <button
                className="btn plan-takeoff__cta"
                type="submit"
                data-testid="plan-submit"
                id="plan-submit-host"
                disabled={disabled}
              >
                <span>{t("play.plan.plan_cta_plan")}</span>
                <span>{t("play.plan.plan_cta_trip")}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
