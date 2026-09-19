"use client";

import { PlanFillRoute } from "@/src/ui/plan-fill-route";
import type { AssistantThreadItem } from "@/src/core/plan-assistant-thread";
import {
  deviationFieldLabel,
  deviationReasonLabel,
  parseDeviationDetail,
  DEVIATION_REASON_KEY_BY_FIELD,
  type SkeletonDeviation,
} from "@/src/core/plan-t3-hydrate";

type Props = {
  items: AssistantThreadItem[];
  fieldLogActive: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onSoftReplan?: () => void;
};

export function PlanAssistantThreadView({ items, fieldLogActive, t, onSoftReplan }: Props) {
  return (
    <>
      {items.map((item) => (
        <ThreadItemRenderer
          key={item.id}
          item={item}
          fieldLogActive={fieldLogActive}
          t={t}
          onSoftReplan={onSoftReplan}
        />
      ))}
    </>
  );
}

function ThreadItemRenderer({
  item,
  fieldLogActive,
  t,
  onSoftReplan,
}: {
  item: AssistantThreadItem;
  fieldLogActive: boolean;
  t: Props["t"];
  onSoftReplan?: () => void;
}) {
  switch (item.kind) {
    case "takeover":
      return (
        <div
          className={
            fieldLogActive
              ? "plan-nav__field-intro"
              : "bubble bubble--agent bubble--agent-notice"
          }
          data-testid="plan-nav-takeover"
        >
          {t("play.plan.assistant_takeover")}
        </div>
      );

    case "progress":
      return item.progressSteps?.length ? (
        <div
          className="msg-group msg-group--agent"
          data-testid="plan-nav-progress"
          aria-live="polite"
        >
          <ol className="plan-progress" data-testid="plan-progress" data-progress-list="">
            {item.progressSteps.map((step) => (
              <li
                key={step.id}
                className={`plan-progress__step is-${step.state}`}
                data-step={step.id}
              >
                <span className="plan-progress__bead" aria-hidden="true" />
                <p className="plan-progress__copy">
                  <span className="plan-progress__label">{t(`play.plan.phase_${step.id}`)}</span>
                  <span className="plan-progress__hint">{t(`play.plan.phase_${step.id}_hint`)}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null;

    case "skeleton_intro":
      return item.content ? (
        fieldLogActive ? (
          <p className="msg-group__line" data-testid="plan-thread-skeleton-intro">
            {item.content}
          </p>
        ) : (
          <div
            className="bubble bubble--agent bubble--agent-notice"
            data-testid="plan-thread-skeleton-intro"
          >
            {item.content}
          </div>
        )
      ) : null;

    case "status":
      return item.statusLines?.length ? (
        fieldLogActive ? (
          <div className="plan-nav__field-status" data-testid="plan-nav-status">
            {item.statusLines.map((line, i) => (
              <p key={`status-${i}`} className="msg-group__line">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="bubble bubble--agent" data-testid="plan-nav-status">
            {item.statusLines.map((line, i) => (
              <p key={`status-${i}`} className="plan-nav__notice-line">
                {line}
              </p>
            ))}
          </div>
        )
      ) : null;

    case "make_elapsed":
      return item.makeElapsedSeconds != null ? (
        <div
          className="plan-make-progress"
          data-testid="plan-make-progress"
          role="progressbar"
          aria-valuetext={t("play.plan.assistant_make_elapsed", {
            seconds: item.makeElapsedSeconds,
          })}
        >
          <div className="plan-make-progress__track" aria-hidden="true">
            <span className="plan-make-progress__bar" />
          </div>
          <p className="msg-group__line" data-testid="plan-make-elapsed">
            {t("play.plan.assistant_make_elapsed", { seconds: item.makeElapsedSeconds })}
          </p>
        </div>
      ) : null;

    case "spine":
      return item.spineDays?.length ? (
        <div
          className={`plan-nav__spine${item.spineVariant === "skeleton" ? " plan-nav__skeleton" : ""}`}
        >
          <PlanFillRoute
            days={item.spineDays}
            variant={item.spineVariant === "skeleton" ? "skeleton" : "fill"}
            data-testid={
              item.spineVariant === "skeleton" ? "plan-thread-skeleton" : "plan-thread-fill-timeline"
            }
          />
        </div>
      ) : null;

    case "complete":
      return item.content ? (
        <div
          className="bubble bubble--agent bubble--agent-notice plan-nav__complete-bubble"
          data-testid="plan-thread-complete"
        >
          {item.content}
        </div>
      ) : null;

    case "deviations":
      return item.deviations?.length ? (
        <DeviationsBlock deviations={item.deviations} t={t} />
      ) : null;

    case "next_hint":
      return item.content ? (
        <div
          className="bubble bubble--agent bubble--agent-notice"
          data-testid="plan-nav-next-hint"
        >
          {item.content}
        </div>
      ) : null;

    case "soft_replan":
      return onSoftReplan ? (
        <div className="plan-nav__soft-cta">
          <button
            type="button"
            className="chip"
            data-testid="plan-nav-soft-replan"
            onClick={onSoftReplan}
          >
            {t("play.plan.replan_soft")}
          </button>
        </div>
      ) : null;

    default:
      return null;
  }
}

function DeviationsBlock({
  deviations,
  t,
}: {
  deviations: SkeletonDeviation[];
  t: Props["t"];
}) {
  return (
    <div
      className="bubble bubble--agent bubble--agent-notice plan-nav__deviations"
      data-testid="plan-thread-deviations"
    >
      <p className="plan-nav__notice-line">{t("play.plan.deviations_heading")}</p>
      {deviations.map((d, i) => {
        const field = deviationFieldLabel(d.field, t);
        const parsed = parseDeviationDetail(d);
        const reasonKey = DEVIATION_REASON_KEY_BY_FIELD[d.field];
        let line: string;
        if (reasonKey && parsed) {
          line = t(reasonKey, parsed);
        } else {
          const raw = d.reason.trim() || d.actual.trim() || d.field;
          const reason = deviationReasonLabel(raw, t);
          line = field ? t("play.plan.deviation_line", { field, reason }) : reason;
        }
        return (
          <p
            key={`${d.field}-${i}`}
            className="plan-nav__notice-line"
            data-testid="plan-thread-deviation-item"
            data-field={d.field || undefined}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}
