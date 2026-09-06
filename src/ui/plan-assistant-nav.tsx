"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/src/i18n/use-t";
import { budgetOptionLabel, normalizeBudgetKey } from "@/src/core/plan-budget";
import { collapseSkeletonPreviewDays } from "@/src/core/plan-skeleton-preview";
import { buildSkeletonRouteDays, type FillRouteDay } from "@/src/core/format-fill-timeline";
import { PlanFillRoute } from "@/src/ui/plan-fill-route";
import {
  INTAKE_DEFAULT_I18N,
  INTAKE_DEFAULT_VALUES,
  INTAKE_STEP_ORDER,
  displayIntakeAnswer,
  intakeQaProgress,
  intakeQuickChips,
  intakeQuestionKey,
  intakeQuestionText,
  joinMustIncludeSelection,
  nextIntakeStep,
  type IntakeAnswers,
  type IntakeStepId,
  type TakeoffFields,
} from "@/src/core/plan-intake";
import { ORIGIN_RETRY_CHIP } from "@/src/core/plan-resolve-origin";

export type SkeletonPreviewDay = {
  dayIndex: number;
  theme?: string;
  stops: { name: string; kind?: string; mealSlot?: string; filled?: boolean; pending?: boolean }[];
};

type Props = {
  open: boolean;
  takeoff: TakeoffFields;
  currentStep: IntakeStepId | null;
  answers: IntakeAnswers;
  intakeComplete: boolean;
  /** True while plan NDJSON stream is in flight after intake (disable send). */
  fillingLocked?: boolean;
  skeletonDays: SkeletonPreviewDay[];
  /** Structured fill route-spine (24-P0-ui-B). */
  fillRouteDays?: FillRouteDay[];
  statusLines: string[];
  /** Final complete sentence — rendered after fill spine (tmp-ui bug #4). */
  planCompleteLine?: string | null;
  suggestedMustSee?: string[];
  mustSeeLoading?: boolean;
  makeElapsedSeconds?: string | null;
  onOpen: () => void;
  onClose: () => void;
  originNotFound?: boolean;
  originCandidates?: Array<{ name: string }>;
  originQuery?: string;
  onRetryOrigin?: () => void;
  onAnswer: (step: IntakeStepId, value: string) => void | Promise<boolean | void>;
  onTerminate: () => void;
  onComplete: (answers: IntakeAnswers) => void;
};

const MIN_W = 27;
const MIN_H = 45;
const MAX_W = 40;
const MAX_H = 64;

export function PlanAssistantNav({
  open,
  takeoff,
  currentStep,
  answers,
  intakeComplete,
  fillingLocked = false,
  skeletonDays,
  fillRouteDays = [],
  statusLines,
  planCompleteLine = null,
  suggestedMustSee,
  mustSeeLoading,
  makeElapsedSeconds,
  originNotFound,
  originCandidates,
  originQuery,
  onRetryOrigin,
  onOpen,
  onClose,
  onAnswer,
  onTerminate,
  onComplete,
}: Props) {
  const t = useT();
  const navRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [panelSize, setPanelSize] = useState({ w: MIN_W, h: MIN_H });
  const [draft, setDraft] = useState("");
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [selectedMustSee, setSelectedMustSee] = useState<string[]>([]);

  const skeletonRouteDays = useMemo(
    () => buildSkeletonRouteDays(collapseSkeletonPreviewDays(skeletonDays), t),
    [skeletonDays, t],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep latest assistant output visible (tmp-ui bugs §行程助手 #1).
  useEffect(() => {
    if (!open) return;
    const end = threadEndRef.current;
    const body = bodyRef.current;
    if (end && typeof end.scrollIntoView === "function") {
      end.scrollIntoView({ block: "end", behavior: "smooth" });
    } else if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [open, statusLines, planCompleteLine, fillRouteDays, skeletonRouteDays, makeElapsedSeconds, answers, currentStep]);

  useEffect(() => {
    if (currentStep && !intakeComplete) {
      setDraft(answers[currentStep] ?? "");
      setSelectedChip(null);
      setSelectedMustSee([]);
    } else {
      setDraft("");
      setSelectedChip(null);
      setSelectedMustSee([]);
    }
  }, [currentStep, intakeComplete, answers]);

  const activeStep = intakeComplete ? null : currentStep;
  const qa = intakeQaProgress(activeStep, intakeComplete);
  const budgetKey = normalizeBudgetKey(takeoff.budget);
  const budgetLabel = budgetKey ? budgetOptionLabel(budgetKey, t) : takeoff.budget;
  const contextSummary = `${takeoff.destination} · ${takeoff.days} ${t("play.plan.days_short")} · ${takeoff.partySize} ${t("play.plan.people_short")} · ${budgetLabel} · ${t("play.plan.nav_qa_progress", { current: qa.current, total: qa.total })}`;

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = panelSize.w;
      const startH = panelSize.h;

      function onMove(ev: PointerEvent) {
        const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const dw = (ev.clientX - startX) / root;
        const dh = (ev.clientY - startY) / root;
        setPanelSize({
          w: Math.min(MAX_W, Math.max(MIN_W, startW + dw)),
          h: Math.min(MAX_H, Math.max(MIN_H, startH + dh)),
        });
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelSize.h, panelSize.w],
  );

  const [sending, setSending] = useState(false);

  async function advanceStep(step: IntakeStepId, value: string) {
    if (sending || fillingLocked) return;
    setSending(true);
    try {
      const merged: IntakeAnswers = { ...answers, [step]: value };
      const ok = await onAnswer(step, value);
      if (ok === false) return;
      const next = nextIntakeStep(step);
      if (!next) {
        onComplete(merged);
      }
    } finally {
      setSending(false);
    }
  }

  function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStep || fillingLocked) return;
    if (activeStep === "g" && mustSeeLoading) return;
    if (activeStep === "g") {
      const value =
        joinMustIncludeSelection(selectedMustSee, draft.trim()) || INTAKE_DEFAULT_VALUES.g;
      advanceStep(activeStep, value);
      return;
    }
    const value = draft.trim() || INTAKE_DEFAULT_VALUES[activeStep];
    advanceStep(activeStep, value);
  }

  function submitChip(value: string) {
    if (!activeStep || fillingLocked) return;
    if (value === ORIGIN_RETRY_CHIP) {
      onRetryOrigin?.();
      return;
    }
    if (activeStep === "g") {
      setSelectedMustSee((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
      return;
    }
    setSelectedChip(value);
    advanceStep(activeStep, value);
  }

  const defaultHint =
    activeStep === "g"
      ? undefined
      : activeStep != null
        ? t(INTAKE_DEFAULT_I18N[activeStep])
        : undefined;
  const quickChips = activeStep
    ? intakeQuickChips(activeStep, t, suggestedMustSee, {
        originNotFound,
        originCandidates,
      })
    : [];

  const railPct = intakeComplete
    ? 100
    : Math.round(((qa.current - (activeStep ? 0.5 : 0)) / qa.total) * 100);

  const content = (
    <>
      <button
        type="button"
        className={`plan-nav-launch${open ? " is-hidden" : ""}`}
        data-testid="plan-nav-open"
        aria-controls="plan-nav"
        aria-expanded={open}
        onClick={onOpen}
      >
        <span className="mark-host plan-nav-launch__mark">
          <img className="mark" src="/play-logo.png" alt="" width={28} height={28} />
        </span>
        <span>{t("play.plan.nav_launch")}</span>
      </button>

      <aside
        ref={navRef}
        className={`plan-nav${open ? " is-open" : ""}`}
        id="plan-nav"
        data-testid="plan-nav"
        aria-label={t("play.plan.nav_title")}
        style={
          open
            ? ({
                width: `${panelSize.w}rem`,
                height: `${panelSize.h}rem`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="plan-nav__panel">
          <div className="plan-nav__rail" aria-hidden="true">
            <span className="plan-nav__rail-fill" style={{ height: `${Math.max(8, railPct)}%` }} />
          </div>
          <header className="plan-nav__head">
            <button
              type="button"
              className="plan-nav__resize"
              data-testid="plan-nav-resize"
              aria-label={t("play.plan.nav_resize")}
              title={t("play.plan.nav_resize")}
              onPointerDown={onResizeStart}
            >
              <svg className="plan-nav__resize-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M8 4H4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M12 16h4v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 16l-4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="plan-nav__head-copy">
              <h2 className="plan-nav__title">{t("play.plan.nav_title")}</h2>
              <p className="plan-nav__context">{contextSummary}</p>
            </div>
            <div className="plan-nav__head-actions">
              <button
                type="button"
                className="panel-fold-btn"
                data-testid="plan-nav-close"
                aria-label={t("play.plan.nav_collapse")}
                title={t("play.plan.nav_collapse")}
                onClick={onClose}
              >
                <svg className="panel-fold-btn__icon" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                  <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {!intakeComplete ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="plan-nav-terminate"
                  onClick={onTerminate}
                >
                  {t("play.plan.nav_terminate")}
                </button>
              ) : null}
            </div>
          </header>

          <div className="plan-nav__body" ref={bodyRef} data-testid="plan-nav-body">
            <div className="plan-nav__thread" data-testid="plan-nav-thread">
              <div className="msg-group msg-group--agent">
                <p className="msg-group__line">{t("play.plan.assistant_greeting")}</p>
                {activeStep === "b" && !("b" in answers) ? (
                  <p className="msg-group__line">
                    {t(intakeQuestionKey("b"))}
                    {defaultHint ? (
                      <span className="msg-group__hint">
                        {" "}
                        {t("play.plan.assistant_defaults_hint", { value: defaultHint })}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {originCandidates?.length ? (
                  <p className="msg-group__line" data-testid="plan-origin-candidates">
                    {t("play.plan.intake_origin_candidates", {
                      destination: takeoff.destination.trim() || "—",
                      list: originCandidates
                        .slice(0, 3)
                        .map((c, i) => `${String.fromCharCode(65 + i)} - ${c.name}`)
                        .join(", "),
                    })}
                  </p>
                ) : null}
                {originNotFound ? (
                  <p className="msg-group__line" data-testid="plan-origin-not-found">
                    {t("play.plan.intake_origin_not_found", {
                      destination: takeoff.destination.trim() || "—",
                      query: (originQuery ?? "").trim() || "—",
                    })}
                  </p>
                ) : null}
              </div>

              {INTAKE_STEP_ORDER.map((step) => {
                if (!(step in answers)) return null;
                return (
                  <div key={step} className="bubble bubble--user">
                    {displayIntakeAnswer(step, answers[step], t, suggestedMustSee)}
                  </div>
                );
              })}

              {activeStep && (activeStep !== "b" || "b" in answers) ? (
                <div className="bubble bubble--agent">
                  {activeStep === "g" && mustSeeLoading && !suggestedMustSee?.length ? (
                    <span>{t("play.plan.must_see_loading")}</span>
                  ) : (
                    intakeQuestionText(activeStep, t, suggestedMustSee)
                  )}
                  {activeStep === "g" && !mustSeeLoading ? (
                    <span className="msg-group__hint">
                      {" "}
                      {t("play.plan.must_see_multiselect_hint")}{" "}
                      {t("play.plan.assistant_defaults_hint", {
                        value: t(INTAKE_DEFAULT_I18N.g),
                      })}
                    </span>
                  ) : defaultHint ? (
                    <span className="msg-group__hint">
                      {" "}
                      {t("play.plan.assistant_defaults_hint", { value: defaultHint })}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {statusLines.map((line, i) => (
                <p key={`status-${i}`} className="msg-group__line">
                  {line}
                </p>
              ))}

              {makeElapsedSeconds != null ? (
                <div
                  className="plan-make-progress"
                  data-testid="plan-make-progress"
                  role="progressbar"
                  aria-valuetext={t("play.plan.assistant_make_elapsed", {
                    seconds: makeElapsedSeconds,
                  })}
                >
                  <div className="plan-make-progress__track" aria-hidden="true">
                    <span className="plan-make-progress__bar" />
                  </div>
                  <p className="msg-group__line" data-testid="plan-make-elapsed">
                    {t("play.plan.assistant_make_elapsed", { seconds: makeElapsedSeconds })}
                  </p>
                </div>
              ) : null}

              {skeletonRouteDays.length > 0 && fillRouteDays.length === 0 ? (
                <div className="msg-group msg-group--agent plan-nav__skeleton">
                  <PlanFillRoute
                    days={skeletonRouteDays}
                    variant="skeleton"
                    data-testid="plan-thread-skeleton"
                  />
                </div>
              ) : null}

              {fillRouteDays.length > 0 ? (
                <div className="msg-group msg-group--agent">
                  <PlanFillRoute
                    days={fillRouteDays}
                    variant="fill"
                    data-testid="plan-thread-fill-timeline"
                  />
                </div>
              ) : null}

              {planCompleteLine ? (
                <p
                  className="msg-group__line plan-nav__complete"
                  data-testid="plan-thread-complete"
                >
                  {planCompleteLine}
                </p>
              ) : null}
              <div ref={threadEndRef} data-testid="plan-nav-thread-end" aria-hidden="true" />
            </div>

            {quickChips.length > 0 && activeStep && !(activeStep === "g" && mustSeeLoading) ? (
              <div className="plan-nav__quick" role="group" aria-label={t("play.plan.nav_quick_aria")}>
                {quickChips.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    className={`chip${activeStep === "g" ? (selectedMustSee.includes(chip.value) ? " is-on" : "") : selectedChip === chip.value ? " is-on" : ""}`}
                    disabled={fillingLocked || sending}
                    aria-disabled={fillingLocked || sending}
                    data-testid={
                      chip.labelKey === "play.plan.intake_origin_skip"
                        ? "plan-origin-skip"
                        : chip.labelKey === "play.plan.intake_origin_retry"
                          ? "plan-origin-retry"
                          : undefined
                    }
                    onClick={() => submitChip(chip.value)}
                  >
                    {chip.labelKey ? t(chip.labelKey) : chip.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {(!intakeComplete && activeStep) || intakeComplete ? (
            <form className="chat-composer plan-nav__composer" onSubmit={submitAnswer}>
              <label className="sr-only" htmlFor="nav-input">
                {t("play.chat.input_label")}
              </label>
              <input
                id="nav-input"
                name="q"
                placeholder={t("play.plan.nav_input_ph")}
                data-testid="plan-nav-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                className={`btn${fillingLocked || sending ? " is-send-locked" : ""}`}
                type="submit"
                data-testid="plan-nav-send"
                disabled={
                  fillingLocked ||
                  sending ||
                  (activeStep === "g" && Boolean(mustSeeLoading))
                }
                aria-disabled={
                  fillingLocked ||
                  sending ||
                  (activeStep === "g" && Boolean(mustSeeLoading))
                }
              >
                {t("play.chat.send")}
              </button>
            </form>
          ) : null}
        </div>
      </aside>
    </>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
