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
import { ORIGIN_RETRY_CHIP, originPickChipValue } from "@/src/core/plan-resolve-origin";
import { PLAN_NAV_MIN_H, PLAN_NAV_MIN_W, nextPanelSizeRem } from "@/src/core/plan-nav-resize";
import {
  deviationFieldLabel,
  deviationReasonLabel,
  parseDeviationDetail,
  DEVIATION_REASON_KEY_BY_FIELD,
  type SkeletonDeviation,
} from "@/src/core/plan-t3-hydrate";

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
  onRetryMustSee?: () => void | Promise<void>;
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
  agentNeedQuestions?: Array<{
    id: string;
    prompt: string;
    options?: Array<{ id: string; label: string }>;
    multi?: boolean;
  }>;
  agentNeedIndex?: number;
  agentNeedAnswers?: Record<string, string>;
  /** First plan_trip in flight — show wait line + composer (send disabled). */
  awaitingAgentNeeds?: boolean;
  /** Hotel candidate click — PATCH /api/plan/session in flight. */
  verifyingHotel?: boolean;
  onAgentNeedAnswer?: (questionId: string, value: string) => void;
  /** MVP-T3: assistant takeover + phase progress (no fixed 4Q). */
  t3Mode?: boolean;
  t3ProgressSteps?: Array<{ id: string; state: "done" | "current" | "pending" }>;
  frameworkReadyLine?: string | null;
  /** Soft boundary deviations under skeleton (2play-plan-103). */
  deviations?: SkeletonDeviation[];
  nextHintLine?: string | null;
  onSoftReplan?: () => void;
  composerPlaceholder?: string;
};

function catalogNeedPrompt(
  id: string,
  fallback: string,
  t: (key: string) => string,
): string {
  const keys: Record<string, string> = {
    hotel: "play.plan.need_prompt.hotel",
    start_time: "play.plan.need_prompt.start_time",
    must_see: "play.plan.need_prompt.must_see",
    other: "play.plan.need_prompt.other",
    expand_radius: "play.plan.need_prompt.expand_radius",
  };
  const key = keys[id];
  return key ? t(key) : fallback;
}


function catalogNeedOptionLabel(
  questionId: string,
  optionId: string,
  fallback: string,
  t: (key: string) => string,
): string {
  const key = `play.plan.need_option.${questionId}.${optionId}`;
  const translated = t(key);
  return translated !== key ? translated : fallback;
}

const MIN_W = PLAN_NAV_MIN_W;
const MIN_H = PLAN_NAV_MIN_H;

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
  onRetryMustSee,
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
  agentNeedQuestions,
  agentNeedIndex = 0,
  agentNeedAnswers = {},
  awaitingAgentNeeds = false,
  verifyingHotel = false,
  onAgentNeedAnswer,
  t3Mode = false,
  t3ProgressSteps,
  frameworkReadyLine = null,
  deviations = [],
  nextHintLine = null,
  onSoftReplan,
  composerPlaceholder,
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
  }, [open, statusLines, planCompleteLine, fillRouteDays, skeletonRouteDays, makeElapsedSeconds, answers, currentStep, agentNeedAnswers, agentNeedIndex, awaitingAgentNeeds]);

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

  const visibleNeedQuestions = t3Mode
    ? (agentNeedQuestions ?? []).filter((q) => q.id === "expand_radius")
    : (agentNeedQuestions ?? []);
  const visibleNeedIndex = (() => {
    if (!t3Mode) return agentNeedIndex;
    const unanswered = visibleNeedQuestions.findIndex(
      (q) => !Object.prototype.hasOwnProperty.call(agentNeedAnswers, q.id),
    );
    return unanswered === -1 ? visibleNeedQuestions.length : unanswered;
  })();
  const agentQ = visibleNeedQuestions[visibleNeedIndex];
  const useAgentNeeds = Boolean(visibleNeedQuestions.length) || (awaitingAgentNeeds && !t3Mode);
  const activeStep = t3Mode || intakeComplete || useAgentNeeds ? null : currentStep;
  const qa = intakeQaProgress(activeStep, intakeComplete, {
    useAgentNeeds,
    agentNeedIndex: visibleNeedIndex,
    agentNeedTotal: visibleNeedQuestions.length || 4,
  });
  const budgetKey = normalizeBudgetKey(takeoff.budget);
  const budgetLabel = budgetKey ? budgetOptionLabel(budgetKey, t) : takeoff.budget;
  const contextSummary = t3Mode
    ? `${takeoff.destination} · ${takeoff.days} ${t("play.plan.days_short")} · ${takeoff.partySize} ${t("play.plan.people_short")} · ${budgetLabel}`
    : `${takeoff.destination} · ${takeoff.days} ${t("play.plan.days_short")} · ${takeoff.partySize} ${t("play.plan.people_short")} · ${budgetLabel} · ${t("play.plan.nav_qa_progress", { current: qa.current, total: qa.total })}`;

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = panelSize.w;
      const startH = panelSize.h;

      function onMove(ev: PointerEvent) {
        const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        setPanelSize(
          nextPanelSizeRem({
            startW,
            startH,
            startX,
            startY,
            clientX: ev.clientX,
            clientY: ev.clientY,
            rootPx: root,
          }),
        );
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
    if (fillingLocked) return;
    if (useAgentNeeds && agentQ) {
      const qid = agentQ.id;
      const value =
        qid === "must_see"
          ? joinMustIncludeSelection(selectedMustSee, draft.trim())
          : draft.trim();
      setDraft("");
      onAgentNeedAnswer?.(qid, value);
      return;
    }
    if (!activeStep) return;
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
  const agentChipOptions =
    useAgentNeeds && agentQ
      ? agentQ.options?.length
        ? agentQ.options
        : agentQ.id === "hotel" && originCandidates?.length
          ? originCandidates.map((c, i) => ({ id: `cand_${i}`, label: c.name }))
          : agentQ.id === "must_see" && suggestedMustSee?.length
            ? suggestedMustSee.map((label, i) => ({ id: `ms_${i}`, label }))
            : []
      : [];
  const mustSeeChipsEmpty =
    (useAgentNeeds && agentQ?.id === "must_see" && agentChipOptions.length === 0) ||
    (!useAgentNeeds && activeStep === "g" && !(suggestedMustSee?.length));
  const showMustSeeEmpty =
    mustSeeChipsEmpty && !mustSeeLoading && !(awaitingAgentNeeds && !agentQ);
  const showLocalChips =
    !useAgentNeeds &&
    quickChips.length > 0 &&
    Boolean(activeStep) &&
    !(activeStep === "g" && mustSeeLoading);
  const stackProcessChips = true;

  const railPct = t3Mode
    ? t3ProgressSteps?.every((s) => s.state === "done")
      ? 100
      : t3ProgressSteps?.some((s) => s.state === "current")
        ? 55
        : 8
    : intakeComplete
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
              {!intakeComplete || (t3Mode && !frameworkReadyLine) ? (
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
              {t3Mode ? (
                <>
                  <div
                    className="bubble bubble--agent bubble--agent-notice"
                    data-testid="plan-nav-takeover"
                  >
                    {t("play.plan.assistant_takeover")}
                  </div>
                  {t3ProgressSteps?.length ? (
                    <div
                      className="msg-group msg-group--agent"
                      data-testid="plan-nav-progress"
                      aria-live="polite"
                    >
                      <ol className="plan-progress" data-testid="plan-progress" data-progress-list="">
                        {t3ProgressSteps.map((step) => (
                          <li
                            key={step.id}
                            className={`plan-progress__step is-${step.state}`}
                            data-step={step.id}
                          >
                            <span className="plan-progress__bead" aria-hidden="true" />
                            <p className="plan-progress__copy">
                              <span className="plan-progress__label">
                                {t(`play.plan.phase_${step.id}`)}
                              </span>
                              <span className="plan-progress__hint">
                                {t(`play.plan.phase_${step.id}_hint`)}
                              </span>
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {frameworkReadyLine ? (
                    <div
                      className="bubble bubble--agent bubble--agent-notice"
                      data-testid="plan-thread-skeleton-intro"
                    >
                      {frameworkReadyLine}
                    </div>
                  ) : null}
                </>
              ) : null}

              {!t3Mode ? (
              <div className="msg-group msg-group--agent">
                {useAgentNeeds ? (
                  <p className="msg-group__line" data-testid="plan-nav-searching">
                    {t("play.plan.assistant_searching")}
                  </p>
                ) : null}
                {!awaitingAgentNeeds ? (
                  <p className="msg-group__line" data-testid="plan-nav-greeting">
                    {t("play.plan.assistant_greeting")}
                  </p>
                ) : null}
                {activeStep === "b" && !("b" in answers) && !originNotFound && !originCandidates?.length ? (
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
                {!useAgentNeeds && originNotFound ? (
                  <p className="msg-group__line" data-testid="plan-origin-not-found">
                    {t("play.plan.intake_origin_not_found", {
                      destination: takeoff.destination.trim() || "—",
                      query: (originQuery ?? "").trim() || "—",
                    })}
                  </p>
                ) : null}
                {!useAgentNeeds && (originCandidates?.length ?? 0) > 0 ? (
                  <p className="msg-group__line" data-testid="plan-origin-candidates">
                    {t("play.plan.intake_origin_candidates", {
                      destination: takeoff.destination.trim() || "—",
                      query: (originQuery ?? "").trim() || "—",
                    })}
                  </p>
                ) : null}
              </div>
              ) : null}

              {!t3Mode
                ? INTAKE_STEP_ORDER.map((step) => {
                    if (!(step in answers)) return null;
                    return (
                      <div
                        key={step}
                        className="bubble bubble--user"
                        data-testid={`plan-nav-intake-answer-${step}`}
                      >
                        {displayIntakeAnswer(step, answers[step], t, suggestedMustSee)}
                      </div>
                    );
                  })
                : null}

              {useAgentNeeds
                ? visibleNeedQuestions.map((q, i) => {
                    const answered = Object.prototype.hasOwnProperty.call(agentNeedAnswers, q.id);
                    if (i > visibleNeedIndex && !answered) return null;
                    return (
                      <div key={q.id}>
                        {i < visibleNeedIndex || answered ? (
                          <>
                            <div className="bubble bubble--agent">{catalogNeedPrompt(q.id, q.prompt, t)}</div>
                            <div className="bubble bubble--user" data-testid={`plan-nav-need-answer-${q.id}`}>
                              {(agentNeedAnswers[q.id] ?? "").trim() || t("play.plan.need_skipped")}
                            </div>
                          </>
                        ) : i === visibleNeedIndex ? (
                          <>
                            {q.id === "hotel" && (originNotFound || (originCandidates?.length ?? 0) > 0) ? (
                              <div
                                className="bubble bubble--agent"
                                data-testid={originNotFound ? "plan-origin-not-found" : "plan-origin-candidates"}
                              >
                                {originNotFound
                                  ? t("play.plan.intake_origin_not_found", {
                                      destination: takeoff.destination.trim() || "—",
                                      query: (originQuery ?? "").trim() || "—",
                                    })
                                  : t("play.plan.intake_origin_candidates", {
                                      destination: takeoff.destination.trim() || "—",
                                      query: (originQuery ?? "").trim() || "—",
                                    })}
                              </div>
                            ) : (
                              <div className="bubble bubble--agent" data-testid="plan-nav-need-prompt">
                                {catalogNeedPrompt(q.id, q.prompt, t)}
                              </div>
                            )}
                            {q.id === "hotel" && verifyingHotel ? (
                              <p className="msg-group__line" data-testid="plan-nav-verifying-hotel">
                                {t("play.plan.verifying_hotel")}
                              </p>
                            ) : null}
                            {q.id === "must_see" && showMustSeeEmpty ? (
                              <p className="msg-group__line" data-testid="plan-must-see-empty">
                                {t("play.plan.must_see_empty")}
                              </p>
                            ) : null}
                            {q.id === "must_see" && showMustSeeEmpty && onRetryMustSee ? (
                              <div
                                className="plan-nav__quick"
                                role="group"
                                aria-label={t("play.plan.nav_quick_aria")}
                              >
                                <button
                                  type="button"
                                  className="chip chip--ghost"
                                  data-testid="plan-must-see-refetch"
                                  disabled={Boolean(mustSeeLoading)}
                                  aria-disabled={Boolean(mustSeeLoading)}
                                  onClick={() => {
                                    void onRetryMustSee();
                                  }}
                                >
                                  {t("play.plan.must_see_refetch")}
                                </button>
                              </div>
                            ) : null}
                            {q.id === "hotel" && originNotFound ? null : agentChipOptions.length > 0 ? (
                              <div
                                className={`plan-nav__quick${stackProcessChips ? " plan-nav__quick--stack" : ""}`}
                                role="group"
                                aria-label={t("play.plan.nav_quick_aria")}
                                data-testid="plan-nav-thread-chips"
                              >
                                {agentChipOptions.map((opt, chipIndex) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    className={`chip${q.multi && selectedMustSee.includes(opt.label) ? " is-on" : ""}`}
                                    data-testid={`plan-need-chip-${opt.id}`}
                                    disabled={verifyingHotel && q.id === "hotel"}
                                    aria-disabled={verifyingHotel && q.id === "hotel"}
                                    onClick={() => {
                                      if (verifyingHotel && q.id === "hotel") return;
                                      if (q.multi) {
                                        setSelectedMustSee((prev) =>
                                          prev.includes(opt.label)
                                            ? prev.filter((v) => v !== opt.label)
                                            : [...prev, opt.label],
                                        );
                                        return;
                                      }
                                      if (q.id === "hotel") {
                                        const fromId = /^cand_(\d+)$/.exec(opt.id);
                                        const idx = fromId ? Number(fromId[1]) : chipIndex;
                                        onAgentNeedAnswer?.(q.id, originPickChipValue(idx));
                                        return;
                                      }
                                      if (q.id === "expand_radius") {
                                        onAgentNeedAnswer?.(
                                          q.id,
                                          opt.id === "yes" || opt.id === "no" ? opt.id : opt.label,
                                        );
                                        return;
                                      }
                                      onAgentNeedAnswer?.(q.id, opt.label);
                                    }}
                                  >
                                    {catalogNeedOptionLabel(q.id, opt.id, opt.label, t)}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    );
                  })
                : null}

              {awaitingAgentNeeds && !agentQ ? (
                <p className="msg-group__line sr-only" data-testid="plan-nav-waiting">
                  {t("play.plan.assistant_searching")}
                </p>
              ) : null}

              {!useAgentNeeds && activeStep && (activeStep !== "b" || "b" in answers) ? (
                <div className="bubble bubble--agent">
                  {activeStep === "g" && mustSeeLoading && !suggestedMustSee?.length ? (
                    <span>{t("play.plan.must_see_loading")}</span>
                  ) : (
                    intakeQuestionText(activeStep, t, suggestedMustSee)
                  )}
                  {activeStep === "g" && showMustSeeEmpty ? (
                    <span className="msg-group__hint" data-testid="plan-must-see-empty">
                      {" "}
                      {t("play.plan.must_see_empty")}
                    </span>
                  ) : null}
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

              {!useAgentNeeds && activeStep === "g" && showMustSeeEmpty && onRetryMustSee ? (
                <div
                  className="plan-nav__quick"
                  role="group"
                  aria-label={t("play.plan.nav_quick_aria")}
                >
                  <button
                    type="button"
                    className="chip chip--ghost"
                    data-testid="plan-must-see-refetch"
                    disabled={Boolean(mustSeeLoading) || fillingLocked}
                    aria-disabled={Boolean(mustSeeLoading) || fillingLocked}
                    onClick={() => {
                      void onRetryMustSee();
                    }}
                  >
                    {t("play.plan.must_see_refetch")}
                  </button>
                </div>
              ) : null}

              {!useAgentNeeds && showLocalChips ? (
                <div
                  className={`plan-nav__quick${stackProcessChips ? " plan-nav__quick--stack" : ""}`}
                  role="group"
                  aria-label={t("play.plan.nav_quick_aria")}
                  data-testid="plan-nav-thread-chips"
                >
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

              {statusLines.length > 0 ? (
                <div className="bubble bubble--agent" data-testid="plan-nav-status">
                  {statusLines.map((line, i) => (
                    <p key={`status-${i}`} className="plan-nav__notice-line">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}

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

              {deviations.length > 0 ? (
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
              ) : null}

              {nextHintLine ? (
                <div
                  className="bubble bubble--agent bubble--agent-notice"
                  data-testid="plan-nav-next-hint"
                >
                  {nextHintLine}
                </div>
              ) : null}

              {onSoftReplan && frameworkReadyLine ? (
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
          </div>

          {(() => {
            const showComposer =
              (!intakeComplete && (activeStep || useAgentNeeds || awaitingAgentNeeds)) ||
              intakeComplete;

            return (
              <div className="plan-nav__dock" data-testid="plan-nav-dock">
                {showComposer ? (
                  <form className="chat-composer plan-nav__composer" onSubmit={submitAnswer}>
                    <label className="sr-only" htmlFor="nav-input">
                      {t("play.chat.input_label")}
                    </label>
                    <input
                      id="nav-input"
                      name="q"
                      placeholder={composerPlaceholder ?? t("play.plan.nav_input_ph")}
                      data-testid="plan-nav-input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={awaitingAgentNeeds && !agentQ}
                    />
                    <button
                      className={`btn${fillingLocked || sending || (awaitingAgentNeeds && !agentQ) ? " is-send-locked" : ""}`}
                      type="submit"
                      data-testid="plan-nav-send"
                      disabled={
                        fillingLocked ||
                        sending ||
                        verifyingHotel ||
                        (awaitingAgentNeeds && !agentQ) ||
                        (activeStep === "g" && Boolean(mustSeeLoading))
                      }
                      aria-disabled={
                        fillingLocked ||
                        sending ||
                        verifyingHotel ||
                        (awaitingAgentNeeds && !agentQ) ||
                        (activeStep === "g" && Boolean(mustSeeLoading))
                      }
                    >
                      {t("play.chat.send")}
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })()}
        </div>
      </aside>
    </>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
