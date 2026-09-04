"use client";

import {
  BUDGET_OPTION_KEYS,
  budgetOptionLabel,
  normalizeBudgetKey,
} from "@/src/core/plan-budget";
import { useT } from "@/src/i18n/use-t";

export type TakeoffFieldErrors = Partial<
  Record<"destination" | "days" | "startDate" | "partySize" | "budget", string>
>;

type Props = {
  destination: string;
  startDate: string;
  days: string;
  partySize: string;
  budget: string;
  fieldErrors: TakeoffFieldErrors;
  onDestinationChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onDaysChange: (v: string) => void;
  onPartySizeChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
};

export function PlanTakeoffForm({
  destination,
  startDate,
  days,
  partySize,
  budget,
  fieldErrors,
  disabled,
  onDestinationChange,
  onStartDateChange,
  onDaysChange,
  onPartySizeChange,
  onBudgetChange,
  onSubmit,
}: Props) {
  const t = useT();
  const budgetValue = normalizeBudgetKey(budget) || budget;

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
            <div className={`field${fieldErrors.destination ? " is-invalid" : ""}`} data-field="dest">
              <div className="field-label-row">
                <label htmlFor="dest">{t("play.plan.destination")}</label>
                <span className="req" aria-hidden="true">
                  *
                </span>
              </div>
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
              <div className="field-label-row">
                <label htmlFor="start_date">{t("play.plan.start_date")}</label>
                <span className="req" aria-hidden="true">
                  *
                </span>
              </div>
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

            <div className={`field${fieldErrors.days ? " is-invalid" : ""}`} data-field="days">
              <div className="field-label-row">
                <label htmlFor="days">{t("play.plan.days")}</label>
                <span className="req" aria-hidden="true">
                  *
                </span>
              </div>
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
              <p className="field-error" role="alert" hidden={!fieldErrors.days}>
                {fieldErrors.days ? t(fieldErrors.days) : ""}
              </p>
            </div>

            <div className={`field${fieldErrors.partySize ? " is-invalid" : ""}`} data-field="party">
              <div className="field-label-row">
                <label htmlFor="party">{t("play.plan.party")}</label>
                <span className="req" aria-hidden="true">
                  *
                </span>
              </div>
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

            <div className={`field${fieldErrors.budget ? " is-invalid" : ""}`} data-field="budget">
              <div className="field-label-row">
                <label htmlFor="budget">{t("play.plan.budget")}</label>
                <span className="req" aria-hidden="true">
                  *
                </span>
              </div>
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
                <option value="">{t("play.plan.combo_or_custom")}</option>
                {BUDGET_OPTION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {budgetOptionLabel(key, t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="plan-takeoff__actions">
              <div className="field">
                <label className="sr-only" htmlFor="plan-submit-host">
                  {t("play.plan.plan_cta")}
                </label>
                <button
                  className="btn"
                  type="submit"
                  data-testid="plan-submit"
                  id="plan-submit-host"
                  disabled={disabled}
                >
                  {t("play.plan.plan_cta")}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
