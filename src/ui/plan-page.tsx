"use client";

import { useEffect, useState } from "react";
import { INTEREST_IDS, INTEREST_LABEL_KEYS } from "@/src/core/interests";
import type { ItineraryDto, ItinerarySlot, CandidatePlacePreview } from "@/src/core/itinerary-types";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson, authNdjsonEvents, AuthApiError } from "@/src/ui/auth-api";
import { PlanCombo } from "@/src/ui/plan-combo";
import { PlanItineraryView } from "@/src/ui/plan-itinerary-view";
import { PlanChatPanel } from "@/src/ui/plan-chat";
import { usePageTitle } from "@/src/ui/use-page-title";

type FieldErrors = Partial<Record<"destination" | "days" | "startDate" | "timeFrom" | "timeTo", string>>;

type PlanCurrentResponse = {
  ok: boolean;
  criteria: {
    destination?: string;
    days?: number;
    startDate?: string;
    partySize?: number;
    tripType?: string;
    budget?: string;
    pace?: string;
    transport?: string;
    dailyStart?: string;
    dailyEnd?: string;
    timeFrom?: string;
    timeTo?: string;
    interests?: string[];
    constraints?: string;
  } | null;
  itinerary: ItineraryDto | null;
};

export default function PlanPageClient() {
  const t = useT();
  const locale = useLocale();
  usePageTitle("play.plan.page_title");

  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [days, setDays] = useState("3");
  const [partySize, setPartySize] = useState("2");
  const [tripType, setTripType] = useState("");
  const [budget, setBudget] = useState("");
  const [pace, setPace] = useState("");
  const [transport, setTransport] = useState("");
  const [dailyStart, setDailyStart] = useState("");
  const [dailyEnd, setDailyEnd] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [constraints, setConstraints] = useState("");
  const [itinerary, setItinerary] = useState<ItineraryDto | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [planPhase, setPlanPhase] = useState<"idle" | "discovering" | "arranging">("idle");
  const [candidates, setCandidates] = useState<CandidatePlacePreview[]>([]);
  const [candidateCounts, setCandidateCounts] = useState<{ places: number; restaurants: number } | null>(
    null,
  );
  const [liveSlots, setLiveSlots] = useState<ItinerarySlot[]>([]);
  const [focusDayIndex, setFocusDayIndex] = useState<number | null>(null);
  const [slotPreview, setSlotPreview] = useState<{
    kind: "place" | "transit" | "meal";
    name: string;
    reason: string;
    window: string;
    mealLabel?: "lunch" | "afternoon_tea" | "dinner";
    transportLabel?: string;
  } | null>(null);
  const [liveHighlights, setLiveHighlights] = useState<{
    label: string;
    title: string;
    theme?: string;
    tags: string[];
  } | null>(null);
  const [dayPending, setDayPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNoticeKey, setSaveNoticeKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cachedInterests: string[] | undefined;
      try {
        const data = await authJson<PlanCurrentResponse>("/api/plan/current");
        if (cancelled) return;
        if (data.criteria) {
          const c = data.criteria;
          if (c.destination) setDestination(c.destination);
          if (c.days != null) setDays(String(c.days));
          if (c.startDate) setStartDate(c.startDate);
          if (c.partySize != null) setPartySize(String(c.partySize));
          if (c.tripType) setTripType(c.tripType);
          if (c.budget) setBudget(c.budget);
          if (c.pace) setPace(c.pace);
          if (c.transport) setTransport(c.transport);
          if (c.dailyStart) setDailyStart(c.dailyStart);
          if (c.dailyEnd) setDailyEnd(c.dailyEnd);
          if (c.timeFrom) setTimeFrom(c.timeFrom);
          if (c.timeTo) setTimeTo(c.timeTo);
          if (c.interests?.length) {
            setInterests(c.interests);
            cachedInterests = c.interests;
          }
          if (c.constraints) setConstraints(c.constraints);
        }
        if (data.itinerary) setItinerary(data.itinerary);

        if (!cachedInterests?.length) {
          try {
            const profile = await authJson<{ interests?: string[] }>("/api/profile/personal");
            if (!cancelled && profile.interests?.length) {
              setInterests(profile.interests);
            }
          } catch {
            /* profile optional for prefill */
          }
        }
      } catch {
        /* empty plan is fine */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleInterest(id: string) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSaveItinerary() {
    if (!itinerary || loading || saving) return;
    setSaveNoticeKey(null);
    setSaving(true);
    try {
      await authJson<{ id: string; savedAt: string }>("/api/saved", {
        method: "POST",
        body: JSON.stringify({ itinerary, messages: [] }),
      });
      setSaveNoticeKey("play.plan.save_success");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setSaveNoticeKey(resolveErrorKey(err.key));
      } else {
        setSaveNoticeKey("play.errors.network");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setFieldErrors({});
    // Clear previous itinerary immediately so regenerate never shows stale days.
    setItinerary(null);
    setLoading(true);
    setGenProgress(null);
    setPlanPhase("discovering");
    setCandidates([]);
    setCandidateCounts(null);
    setLiveSlots([]);
    setFocusDayIndex(null);
    setSlotPreview(null);
    setLiveHighlights(null);
    setDayPending(false);
    const interestPayload = [
      ...interests,
      ...(customInterest.trim() ? [customInterest.trim()] : []),
    ];
    try {
      let sawDone = false;
      let sawError: string | null = null;
      await authNdjsonEvents<{
        type: string;
        phase?: string;
        dayIndex?: number;
        daysTotal?: number;
        itinerary?: ItineraryDto;
        place?: CandidatePlacePreview;
        slot?: ItinerarySlot;
        placeCount?: number;
        restaurantCount?: number;
        poolTotal?: number;
        usedCount?: number;
        title?: string;
        theme?: string;
        key?: string;
        kind?: "place" | "transit" | "meal";
        name?: string;
        reason?: string;
        window?: string;
        mealLabel?: "lunch" | "afternoon_tea" | "dinner";
        transportLabel?: string;
      }>(
        "/api/plan",
        {
          method: "POST",
          body: JSON.stringify({
            destination,
            days: Number(days),
            startDate,
            partySize: partySize ? Number(partySize) : undefined,
            tripType: tripType || undefined,
            budget: budget || undefined,
            pace: pace || undefined,
            transport: transport || undefined,
            dailyStart: dailyStart || undefined,
            dailyEnd: dailyEnd || undefined,
            timeFrom: timeFrom || undefined,
            timeTo: timeTo || undefined,
            interests: interestPayload,
            constraints: constraints || undefined,
            locale,
          }),
        },
        (event) => {
          if (event.type === "phase") {
            if (event.phase === "discovering") setPlanPhase("discovering");
            if (event.phase === "arranging") {
              setPlanPhase("arranging");
              setLiveSlots([]);
              setLiveHighlights(null);
              setSlotPreview(null);
              setDayPending(true);
              if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
              if (event.dayIndex != null && event.daysTotal != null) {
                setGenProgress({ current: event.dayIndex, total: event.daysTotal });
              }
            }
          } else if (event.type === "candidate_place" && event.place) {
            setCandidates((prev) => [...prev, event.place!]);
          } else if (event.type === "discover_done") {
            setCandidateCounts({
              places: event.placeCount ?? 0,
              restaurants: event.restaurantCount ?? 0,
            });
          } else if (event.type === "arrange_day_start") {
            setPlanPhase("arranging");
            setLiveSlots([]);
            setSlotPreview(null);
            setDayPending(true);
            if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
            if (event.dayIndex != null && event.daysTotal != null) {
              setGenProgress({ current: event.dayIndex, total: event.daysTotal });
            }
          } else if (event.type === "day_highlights") {
            setDayPending(true);
            if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
            setLiveHighlights({
              label: "Highlights",
              title: event.title?.trim() || "…",
              theme: event.theme || t("play.plan.highlights_theme_streaming"),
              tags: [],
            });
          } else if (event.type === "slot_preview" && event.kind && event.name) {
            setSlotPreview({
              kind: event.kind,
              name: event.name,
              reason: event.reason ?? "",
              window: event.window ?? "",
              ...(event.mealLabel ? { mealLabel: event.mealLabel } : {}),
              ...(event.transportLabel ? { transportLabel: event.transportLabel } : {}),
            });
            setDayPending(true);
            if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
          } else if (
            (event.type === "slot" || event.type === "place") &&
            event.slot
          ) {
            // Prefer `slot`; ignore duplicate `place` alias when both are emitted.
            if (event.type === "place") return;
            const slot = event.slot;
            setLiveSlots((prev) => {
              const next = [...prev, slot];
              const names = next
                .filter((s): s is Extract<ItinerarySlot, { kind: "place" }> => s.kind === "place")
                .map((s) => s.name);
              if (names.length) {
                queueMicrotask(() => {
                  setLiveHighlights({
                    label: "Highlights",
                    title: `${names.join(" · ")} · …`,
                    theme: t("play.plan.highlights_theme_streaming"),
                    tags: [],
                  });
                });
              }
              return next;
            });
            setDayPending(true);
            if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
          } else if (
            (event.type === "progress" || event.type === "day_done") &&
            event.itinerary
          ) {
            setItinerary(event.itinerary);
            setLiveSlots([]);
            setLiveHighlights(null);
            setSlotPreview(null);
            setDayPending(false);
            if (event.dayIndex != null && event.daysTotal != null) {
              setGenProgress({ current: event.dayIndex, total: event.daysTotal });
              const nextFocus =
                event.dayIndex < event.daysTotal ? event.dayIndex + 1 : event.dayIndex;
              setFocusDayIndex(nextFocus);
            } else if (event.dayIndex != null) {
              setFocusDayIndex(event.dayIndex);
            }
          } else if (event.type === "done" && event.itinerary) {
            sawDone = true;
            setItinerary(event.itinerary);
            setGenProgress(null);
            setPlanPhase("idle");
            setCandidates([]);
            setLiveSlots([]);
            setLiveHighlights(null);
            setSlotPreview(null);
            setDayPending(false);
            setFocusDayIndex(null);
          } else if (event.type === "error") {
            sawError = event.key ?? "errors.provider_failed";
          }
        },
      );
      if (sawError && !sawDone) {
        setErrorKey(resolveErrorKey(sawError));
      }
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.fields) setFieldErrors(err.fields);
        setErrorKey(resolveErrorKey(err.key));
      } else {
        setErrorKey("play.errors.provider_failed");
      }
    } finally {
      setLoading(false);
      setGenProgress(null);
      setPlanPhase("idle");
      setFocusDayIndex(null);
      setDayPending(false);
      setLiveHighlights(null);
      setSlotPreview(null);
    }
  }

  const tripTypeOptions = [
    t("play.plan.trip_type.city"),
    t("play.plan.trip_type.couple"),
    t("play.plan.trip_type.family"),
    t("play.plan.trip_type.solo"),
    t("play.plan.trip_type.food"),
  ];
  const budgetOptions = [
    t("play.plan.budget.economy"),
    t("play.plan.budget.mid"),
    t("play.plan.budget.comfort"),
  ];
  const paceOptions = [
    t("play.plan.pace.tight"),
    t("play.plan.pace.medium"),
    t("play.plan.pace.relaxed"),
  ];
  const transportOptions = [
    t("play.plan.transport.metro_walk"),
    t("play.plan.transport.walk"),
    t("play.plan.transport.taxi"),
    t("play.plan.transport.bus_walk"),
  ];

  return (
    <main id="content" className="app-main" data-testid="plan-page">
      <h1 className="page-title">{t("play.plan.page_title")}</h1>

      <div className="plan-stack">
        <section
          className={`panel planner-card${loading ? " is-dimmed" : ""}`}
          aria-label={t("play.plan.form_aria")}
          aria-disabled={loading || undefined}
        >
          <div className="panel__body">
            <form
              className="plan-form plan-board"
              id="plan-form"
              data-testid="plan-form"
              noValidate
              onSubmit={onSubmit}
            >
              <div className="plan-board__grid">
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
                    onChange={(e) => setDestination(e.target.value)}
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
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <p className="field-error" role="alert" hidden={!fieldErrors.startDate}>
                    {fieldErrors.startDate ? t(fieldErrors.startDate) : ""}
                  </p>
                </div>

                <div className="plan-when">
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
                      onChange={(e) => setDays(e.target.value)}
                    />
                    <p className="field-error" role="alert" hidden={!fieldErrors.days}>
                      {fieldErrors.days ? t(fieldErrors.days) : ""}
                    </p>
                  </div>
                  <div className="field" data-field="party">
                    <label htmlFor="party">{t("play.plan.party")}</label>
                    <input
                      id="party"
                      name="party"
                      type="number"
                      min={1}
                      max={20}
                      value={partySize}
                      onChange={(e) => setPartySize(e.target.value)}
                    />
                  </div>
                  <div className="field" data-field="daily_start">
                    <label htmlFor="daily_start">{t("play.plan.daily_start")}</label>
                    <input
                      id="daily_start"
                      name="daily_start"
                      value={dailyStart}
                      placeholder={t("play.plan.daily_start_ph")}
                      onChange={(e) => setDailyStart(e.target.value)}
                    />
                  </div>
                  <div className="field" data-field="daily_end">
                    <label htmlFor="daily_end">{t("play.plan.daily_end")}</label>
                    <input
                      id="daily_end"
                      name="daily_end"
                      value={dailyEnd}
                      placeholder={t("play.plan.daily_end_ph")}
                      onChange={(e) => setDailyEnd(e.target.value)}
                    />
                  </div>
                  <div className={`field${fieldErrors.timeFrom ? " is-invalid" : ""}`} data-field="time_from">
                    <label htmlFor="time_from">{t("play.plan.time_from")}</label>
                    <input
                      id="time_from"
                      name="time_from"
                      type="time"
                      value={timeFrom}
                      onChange={(e) => setTimeFrom(e.target.value)}
                    />
                  </div>
                  <span className="plan-to" aria-hidden="true">
                    {t("play.plan.time_to_sep")}
                  </span>
                  <div className={`field${fieldErrors.timeTo ? " is-invalid" : ""}`} data-field="time_to">
                    <label htmlFor="time_to">{t("play.plan.time_to")}</label>
                    <input
                      id="time_to"
                      name="time_to"
                      type="time"
                      value={timeTo}
                      onChange={(e) => setTimeTo(e.target.value)}
                    />
                    <p className="field-error" role="alert" hidden={!fieldErrors.timeTo}>
                      {fieldErrors.timeTo ? t(fieldErrors.timeTo) : ""}
                    </p>
                  </div>
                </div>

                <div className="plan-board__stack">
                  <div className="field">
                    <label htmlFor="trip_type">{t("play.plan.trip_type")}</label>
                    <PlanCombo
                      id="trip_type"
                      name="trip_type"
                      value={tripType}
                      options={tripTypeOptions}
                      onChange={setTripType}
                      placeholder={t("play.plan.combo_or_custom")}
                      toggleLabel={t("play.plan.open_trip_type")}
                    />
                  </div>
                  <div className="field" data-field="budget">
                    <label htmlFor="budget">{t("play.plan.budget")}</label>
                    <PlanCombo
                      id="budget"
                      name="budget"
                      value={budget}
                      options={budgetOptions}
                      onChange={setBudget}
                      toggleLabel={t("play.plan.open_budget")}
                    />
                  </div>
                </div>

                <div className="plan-board__stack">
                  <div className="field">
                    <label htmlFor="pace">{t("play.plan.pace")}</label>
                    <PlanCombo
                      id="pace"
                      name="pace"
                      value={pace}
                      options={paceOptions}
                      onChange={setPace}
                      toggleLabel={t("play.plan.open_pace")}
                    />
                  </div>
                  <div className="field" data-field="transport">
                    <label htmlFor="transport">{t("play.plan.transport")}</label>
                    <PlanCombo
                      id="transport"
                      name="transport"
                      value={transport}
                      options={transportOptions}
                      onChange={setTransport}
                      toggleLabel={t("play.plan.open_transport")}
                    />
                  </div>
                </div>

                <div className="plan-prefs-block">
                  <h3 className="plan-prefs-block__title">{t("play.plan.prefs_title")}</h3>
                  <div className="pref-scroll" role="group" aria-label={t("play.plan.prefs_title")}>
                    {INTEREST_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`chip${interests.includes(id) ? " is-on" : ""}`}
                        data-interest={id}
                        data-testid={`plan-interest-${id}`}
                        onClick={() => toggleInterest(id)}
                      >
                        {t(INTEREST_LABEL_KEYS[id])}
                      </button>
                    ))}
                    <div className="pref-custom">
                      <label className="sr-only" htmlFor="interest_custom">
                        {t("play.plan.interest_custom")}
                      </label>
                      <input
                        id="interest_custom"
                        name="interest_custom"
                        placeholder={t("play.plan.interest_custom_ph")}
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field field--constraints">
                    <label htmlFor="constraints">{t("play.plan.constraints")}</label>
                    <input
                      id="constraints"
                      name="constraints"
                      maxLength={500}
                      placeholder={t("play.plan.constraints_ph")}
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                      data-testid="plan-constraints"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </section>

        <div className="plan-board__actions">
          {loading ? (
            <p
              className="plan-phase is-busy"
              data-testid="plan-phase"
              aria-live="polite"
            >
              {planPhase === "arranging" && genProgress
                ? t("play.plan.phase_arranging", {
                    current: genProgress.current,
                    total: genProgress.total,
                  })
                : candidates.length > 0
                  ? t("play.plan.phase_discovering_count", {
                      destination: destination || "…",
                      count: candidates.length,
                    })
                  : t("play.plan.phase_discovering", { destination: destination || "…" })}
            </p>
          ) : null}
          <button
            className={`btn${loading ? " is-generating" : ""}`}
            type="submit"
            form="plan-form"
            data-testid="plan-submit"
            disabled={loading || !hydrated}
          >
            {loading
              ? planPhase === "discovering"
                ? t("play.plan.searching")
                : genProgress
                  ? t("play.plan.generating_day", {
                      current: genProgress.current,
                      total: genProgress.total,
                    })
                  : t("play.plan.generating")
              : t("play.plan.submit")}
          </button>
        </div>

        <p className="error" role="alert" hidden={!errorKey} data-testid="plan-error">
          {errorKey ? t(errorKey) : ""}
        </p>

        {loading && candidates.length > 0 && planPhase === "discovering" ? (
          <section className="panel" aria-labelledby="cand-title" data-testid="plan-candidates">
            <div className="panel__head">
              <h2 id="cand-title">{t("play.plan.candidates_title")}</h2>
            </div>
            <div className="panel__body">
              {candidates.map((c, idx) => (
                <div key={`${c.name}-${idx}`} className="slot slot--candidate is-entering">
                  <div className="slot-time">{t("play.plan.slot_pending")}</div>
                  <div className="slot-body">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="slot-thumb" src={c.photoUrl} alt="" />
                    ) : null}
                    <div className="slot-main">
                      <div className="slot-copy">
                        <span className="slot-kind">{c.placeKind}</span>
                        <h3>{c.name}</h3>
                        {c.summary ? <p>{c.summary}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {loading && planPhase === "arranging" ? (
          <p className="plan-slot-preview" data-testid="plan-slot-preview">
            {slotPreview
              ? slotPreview.kind === "transit"
                ? t("play.plan.preview_transit", {
                    label: slotPreview.transportLabel || slotPreview.name,
                    reason: slotPreview.reason?.startsWith("play.")
                      ? t(slotPreview.reason)
                      : slotPreview.reason,
                    duration: slotPreview.window,
                  })
                : slotPreview.kind === "meal"
                  ? t("play.plan.preview_meal", {
                      meal: t(
                        slotPreview.mealLabel === "dinner"
                          ? "play.plan.meal_dinner"
                          : slotPreview.mealLabel === "afternoon_tea"
                            ? "play.plan.meal_afternoon_tea"
                            : "play.plan.meal_lunch",
                      ),
                      name: slotPreview.name,
                      reason: slotPreview.reason,
                      window: slotPreview.window,
                    })
                  : t("play.plan.preview_place", {
                      name: slotPreview.name,
                      reason: slotPreview.reason,
                      window: slotPreview.window,
                    })
              : t("play.plan.arrange_planning_day", {
                  current: genProgress?.current ?? focusDayIndex ?? 1,
                  total: genProgress?.total ?? (Number(days) || 1),
                })}
          </p>
        ) : null}

        {itinerary || (loading && planPhase === "arranging") ? (
          <PlanItineraryView
            itinerary={
              itinerary ?? {
                title: destination || t("play.plan.page_title"),
                destination: destination || "",
                daysCount: Number(days) || 1,
                updatedAt: new Date(0).toISOString(),
                days: [],
              }
            }
            focusDayIndex={focusDayIndex ?? undefined}
            daysTotal={genProgress?.total ?? (Number(days) || itinerary?.days.length || 1)}
            liveSlots={planPhase === "arranging" ? liveSlots : []}
            liveHighlights={planPhase === "arranging" ? liveHighlights : null}
            showPending={loading && planPhase === "arranging" && dayPending}
            generating={loading && planPhase === "arranging"}
          />
        ) : null}

        {itinerary && !loading ? (
          <div className="plan-actions" data-testid="plan-actions">
            <button
              type="button"
              className="btn btn-quiet"
              data-testid="plan-save"
              disabled={saving}
              onClick={() => void onSaveItinerary()}
            >
              {saving ? t("play.plan.saving") : t("play.plan.save")}
            </button>
            {saveNoticeKey ? (
              <p className="plan-save-notice" role="status" data-testid="plan-save-notice">
                {t(saveNoticeKey)}
              </p>
            ) : null}
          </div>
        ) : null}

        <PlanChatPanel
          itinerary={itinerary}
          onItineraryUpdate={(next) => setItinerary(next)}
        />
      </div>
    </main>
  );
}
