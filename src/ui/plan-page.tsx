"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItineraryDto, ItinerarySlot, PlanBoundaries } from "@/src/core/itinerary-types";
import {
  buildConstraintItems,
  INTAKE_DEFAULT_VALUES,
  INTAKE_STEP_ORDER,
  mergeIntakeToBoundaries,
  nextIntakeStep,
  takeoffIsValid,
  type IntakeAnswers,
  type IntakeStepId,
  type TakeoffFields,
} from "@/src/core/plan-intake";
import { normalizeBudgetKey } from "@/src/core/plan-budget";
import { formatSlotPreviewLine } from "@/src/core/plan-slot-preview";
import type { SlotPreviewPayload } from "@/src/core/itinerary-map";
import {
  appendAssistantLine,
  createPlanNarrativeContext,
  narrativeFromPlanEvent,
  narrativeLineForSkeletonHeadline,
  narrativeLinesForIntakeComplete,
  type PlanNarrativeContext,
} from "@/src/core/plan-assistant-narrative";
import { formatPlanElapsedSeconds, friendlyMakeErrorKey } from "@/src/core/format-plan-elapsed";
import { skeletonStopsForFocusedDay } from "@/src/core/plan-skeleton-stops";
import { validatePlanBoundaries } from "@/src/core/plan-validate";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson, authNdjsonEvents, AuthApiError } from "@/src/ui/auth-api";
import { PlanAssistantNav, type SkeletonPreviewDay } from "@/src/ui/plan-assistant-nav";
import { PlanConstraintsPanel } from "@/src/ui/plan-constraints-panel";
import { PlanItineraryView } from "@/src/ui/plan-itinerary-view";
import { PlanTakeoffForm, type TakeoffFieldErrors } from "@/src/ui/plan-takeoff-form";
import { PlanTravelTipsPanel, type TravelTipsData } from "@/src/ui/plan-travel-tips-panel";
import { PlaceSheet } from "@/src/ui/place-sheet";
import { ReplanDialog } from "@/src/ui/replan-dialog";
import { usePageTitle } from "@/src/ui/use-page-title";
import type { ItineraryPlaceSlot } from "@/src/core/itinerary-types";
import type { DiscoverPoolRow } from "@/src/core/plan-discover-pool";

type PagePhase = "idle" | "intake" | "planning" | "done";
type PlanSubPhase = "discovering" | "skeleton" | "filling" | "idle";

type PlanCurrentResponse = {
  ok: boolean;
  criteria: PlanBoundaries | null;
  itinerary: ItineraryDto | null;
};

function defaultStartDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function takeoffFromState(
  destination: string,
  startDate: string,
  days: string,
  partySize: string,
  budget: string,
): TakeoffFields {
  return {
    destination,
    startDate,
    days: Number(days) || 1,
    partySize: Number(partySize) || 1,
    budget,
  };
}

export default function PlanPageClient() {
  const t = useT();
  const locale = useLocale();
  usePageTitle("play.plan.page_title");

  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [days, setDays] = useState("3");
  const [partySize, setPartySize] = useState("2");
  const [budget, setBudget] = useState("mid");
  const [pagePhase, setPagePhase] = useState<PagePhase>("idle");
  const [navOpen, setNavOpen] = useState(false);
  const [intakeStep, setIntakeStep] = useState<IntakeStepId | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers>({});
  const [originLookupFailed, setOriginLookupFailed] = useState(false);
  const [originLat, setOriginLat] = useState<number | undefined>();
  const [originLng, setOriginLng] = useState<number | undefined>();
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [replanDialogOpen, setReplanDialogOpen] = useState(false);
  const [replanDialogVariant, setReplanDialogVariant] = useState<"replan" | "terminate">("replan");
  const [pendingReplanAction, setPendingReplanAction] = useState<(() => void) | null>(null);

  const [itinerary, setItinerary] = useState<ItineraryDto | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TakeoffFieldErrors>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [planSubPhase, setPlanSubPhase] = useState<PlanSubPhase>("idle");
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [liveSlots, setLiveSlots] = useState<ItinerarySlot[]>([]);
  const [focusDayIndex, setFocusDayIndex] = useState<number | null>(null);
  const [dayPending, setDayPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNoticeKey, setSaveNoticeKey] = useState<string | null>(null);

  const [travelTips, setTravelTips] = useState<TravelTipsData | null>(null);
  const [travelTipsLoading, setTravelTipsLoading] = useState(false);
  const [travelTipsError, setTravelTipsError] = useState<string | null>(null);
  const [suggestedMustSee, setSuggestedMustSee] = useState<string[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverSettled, setDiscoverSettled] = useState(false);
  const [gCandidatesReady, setGCandidatesReady] = useState(false);
  const [discoverPool, setDiscoverPool] = useState<DiscoverPoolRow[]>([]);
  const [tripId, setTripId] = useState<string | undefined>();
  const [tripRevision, setTripRevision] = useState<number | undefined>();
  const discoverJobRef = useRef<Promise<void>>(Promise.resolve());
  const tripIdRef = useRef<string | undefined>(undefined);
  const tripRevisionRef = useRef<number | undefined>(undefined);
  const [makeElapsedMs, setMakeElapsedMs] = useState<number | null>(null);

  const [skeletonDays, setSkeletonDays] = useState<SkeletonPreviewDay[]>([]);
  const [navStatusLines, setNavStatusLines] = useState<string[]>([]);

  const [slotPreviewText, setSlotPreviewText] = useState<string | null>(null);

  const narrativeCtxRef = useRef<PlanNarrativeContext | null>(null);
  const navLinesRef = useRef<string[]>([]);

  const [placeSheetSlot, setPlaceSheetSlot] = useState<ItineraryPlaceSlot | null>(null);
  const [placeSheetDay, setPlaceSheetDay] = useState<number | null>(null);
  const [placeDetails, setPlaceDetails] = useState<Record<string, unknown> | null>(null);
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState(false);
  const [placeDetailsError, setPlaceDetailsError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const takeoff = useMemo(
    () => takeoffFromState(destination, startDate, days, partySize, budget),
    [destination, startDate, days, partySize, budget],
  );

  const showTakeoff = pagePhase === "idle";
  const showConstraints = pagePhase !== "idle";
  const showItinerary = pagePhase === "planning" || pagePhase === "done" || Boolean(itinerary);

  const mustSeeLoading = intakeStep === "g" && !gCandidatesReady;

  const displaySkeletonStops = useMemo(
    () => skeletonStopsForFocusedDay(skeletonDays, focusDayIndex, liveSlots, planSubPhase),
    [skeletonDays, focusDayIndex, liveSlots, planSubPhase],
  );

  const constraintItems = useMemo(
    () =>
      buildConstraintItems(
        takeoff,
        intakeAnswers,
        t,
        intakeComplete || pagePhase === "planning" || pagePhase === "done",
        suggestedMustSee.length ? suggestedMustSee : undefined,
      ),
    [takeoff, intakeAnswers, t, intakeComplete, pagePhase, suggestedMustSee],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authJson<PlanCurrentResponse>("/api/plan/current");
        if (cancelled) return;
        if (data.criteria) {
          const c = data.criteria;
          if (c.destination) setDestination(c.destination);
          if (c.days != null) setDays(String(c.days));
          if (c.startDate) setStartDate(c.startDate);
          if (c.partySize != null) setPartySize(String(c.partySize));
          if (c.budget) setBudget(normalizeBudgetKey(c.budget) || c.budget);
          if (typeof c.tripId === "string") {
            setTripId(c.tripId);
            tripIdRef.current = c.tripId;
          }
          if (typeof c.revision === "number") {
            setTripRevision(c.revision);
            tripRevisionRef.current = c.revision;
          }
        }
        if (data.itinerary) {
          setItinerary(data.itinerary);
          setPagePhase("done");
        }
      } catch {
        /* empty plan ok */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetPlanningState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setItinerary(null);
    setLoading(false);
    setPlanSubPhase("idle");
    setGenProgress(null);
    setLiveSlots([]);
    setFocusDayIndex(null);
    setDayPending(false);
    setSkeletonDays([]);
    setNavStatusLines([]);
    navLinesRef.current = [];
    narrativeCtxRef.current = null;
    setSlotPreviewText(null);
    setTravelTips(null);
    setTravelTipsError(null);
    setTravelTipsLoading(false);
    setSuggestedMustSee([]);
    setDiscoverLoading(false);
    setDiscoverSettled(false);
    setGCandidatesReady(false);
    setDiscoverPool([]);
    setTripId(undefined);
    tripIdRef.current = undefined;
    setTripRevision(undefined);
    tripRevisionRef.current = undefined;
    setMakeElapsedMs(null);
    setErrorKey(null);
    setFieldErrors({});
    setIntakeAnswers({});
    setIntakeStep(null);
    setIntakeComplete(false);
  }, []);

  const resetToBlankTakeoff = useCallback(() => {
    resetPlanningState();
    setDestination("");
    setStartDate(defaultStartDate());
    setDays("3");
    setPartySize("2");
    setBudget("mid");
    setPagePhase("idle");
    setNavOpen(false);
    void authJson("/api/plan/current", { method: "DELETE" }).catch(() => undefined);
  }, [resetPlanningState]);

  const runPlan = useCallback(
    async (criteria: PlanBoundaries) => {
      setLoading(true);
      setPagePhase("planning");
      setPlanSubPhase(criteria.planMode === "skeleton" ? "skeleton" : "discovering");
      setItinerary(null);
      setMakeElapsedMs(0);
      const makeStartedAt = Date.now();
      const elapsedTimer = window.setInterval(() => {
        setMakeElapsedMs(Date.now() - makeStartedAt);
      }, 100);
      setLiveSlots([]);
      setFocusDayIndex(null);
      setSkeletonDays([]);
      setSlotPreviewText(null);
      setTravelTips(null);
      setTravelTipsError(null);
      setTravelTipsLoading(false);

      let sawDone = false;
      let sawError: string | null = null;
      try {

        await authNdjsonEvents<
          {
            type: string;
            phase?: string;
            dayIndex?: number;
            daysTotal?: number;
            itinerary?: ItineraryDto;
            slot?: ItinerarySlot;
            theme?: string;
            key?: string;
            stops?: { name: string; meal_slot?: string; kind?: string }[];
            data?: TravelTipsData;
          } & Partial<SlotPreviewPayload>
        >(
          "/api/plan",
          {
            method: "POST",
            body: JSON.stringify({
              ...criteria,
              locale,
              ...((criteria.tripId ?? tripId) ? { trip_id: criteria.tripId ?? tripId } : {}),
              ...(typeof (criteria.revision ?? tripRevision) === "number"
                ? { revision: criteria.revision ?? tripRevision }
                : {}),
              ...(criteria.planMode === "skeleton" ? { mode: "skeleton" } : {}),
            }),
          },
          (event) => {
            const applyNarrative = (ev: typeof event) => {
              const ctx =
                narrativeCtxRef.current ??
                createPlanNarrativeContext({
                  t,
                  destination: criteria.destination,
                  days: criteria.days,
                  partySize: criteria.partySize ?? 1,
                  tripType: criteria.tripType,
                });
              const result = narrativeFromPlanEvent(ev, ctx, navLinesRef.current);
              narrativeCtxRef.current = result.ctx;
              navLinesRef.current = result.lines;
              setNavStatusLines(result.lines);
            };

            if (event.type === "tips" && event.data) {
              setTravelTips(event.data);
              setTravelTipsLoading(false);
              setTravelTipsError(null);
            } else if (event.type === "phase") {
              if (event.phase === "discovering") setPlanSubPhase("discovering");
              if (event.phase === "skeleton") setPlanSubPhase("skeleton");
              if (event.phase === "filling") {
                setPlanSubPhase("filling");
                setLiveSlots([]);
                setDayPending(true);
                if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
                if (event.dayIndex != null && event.daysTotal != null) {
                  setGenProgress({ current: event.dayIndex, total: event.daysTotal });
                }
              }
              applyNarrative(event);
            } else if (event.type === "slot_preview" && event.kind && event.name) {
              const preview = event as { type: "slot_preview"; dayIndex?: number } & SlotPreviewPayload;
              const line = formatSlotPreviewLine(preview, t);
              setSlotPreviewText(line);
              if (preview.dayIndex != null) setFocusDayIndex(preview.dayIndex);
              applyNarrative(event);
            } else if (event.type === "skeleton_start" && event.itinerary) {
              setItinerary(event.itinerary);
              setPlanSubPhase("skeleton");
            } else if (event.type === "skeleton_day") {
              if (event.itinerary) setItinerary(event.itinerary);
              if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
              const stops = (event.stops ?? []).map((s) => ({
                name: s.name,
                kind: s.kind,
                mealSlot: s.meal_slot,
              }));
              setSkeletonDays((prev) => {
                const next = prev.filter((d) => d.dayIndex !== event.dayIndex);
                next.push({
                  dayIndex: event.dayIndex ?? 1,
                  theme: event.theme,
                  stops,
                });
                return next.sort((a, b) => a.dayIndex - b.dayIndex);
              });
              if (criteria.planMode !== "skeleton") applyNarrative(event);
            } else if (event.type === "skeleton_done") {
              if (event.itinerary) setItinerary(event.itinerary);
              if (criteria.planMode === "skeleton") {
                const ctx =
                  narrativeCtxRef.current ??
                  createPlanNarrativeContext({
                    t,
                    destination: criteria.destination,
                    days: criteria.days,
                    partySize: criteria.partySize ?? 1,
                    tripType: criteria.tripType,
                  });
                const lines = appendAssistantLine(
                  navLinesRef.current,
                  narrativeLineForSkeletonHeadline(ctx),
                );
                navLinesRef.current = lines;
                setNavStatusLines(lines);
              } else {
                applyNarrative(event);
              }
            } else if (event.type === "transit" && event.slot && event.itinerary) {
              setItinerary(event.itinerary);
              setLiveSlots((prev) => [...prev, event.slot!]);
              if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
            } else if (event.type === "stop_filled" && event.slot && event.itinerary) {
              setItinerary(event.itinerary);
              setLiveSlots((prev) => [...prev, event.slot!]);
              setDayPending(true);
              if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
              applyNarrative(event);
            } else if (event.type === "day_done" && event.itinerary) {
              setItinerary(event.itinerary);
              setLiveSlots([]);
              setDayPending(false);
              if (event.dayIndex != null && event.daysTotal != null) {
                setGenProgress({ current: event.dayIndex, total: event.daysTotal });
              }
            } else if (event.type === "done" && event.itinerary) {
              sawDone = true;
              setItinerary(event.itinerary);
              setPagePhase("done");
              setGenProgress(null);
              setPlanSubPhase(criteria.planMode === "skeleton" ? "skeleton" : "idle");
              setLiveSlots([]);
              setDayPending(false);
              setFocusDayIndex(null);
              if (criteria.planMode !== "skeleton") applyNarrative(event);
            } else if (event.type === "error") {
              sawError = event.key ?? "errors.provider_failed";
            }
          },
        );

        if (sawError && !sawDone) {
          const friendly = friendlyMakeErrorKey(resolveErrorKey(sawError));
          setErrorKey(friendly);
          setPagePhase("done");
          navLinesRef.current = appendAssistantLine(navLinesRef.current, t(friendly));
          setNavStatusLines(navLinesRef.current);
        }
      } catch (err) {
        const key =
          err instanceof AuthApiError
            ? friendlyMakeErrorKey(resolveErrorKey(err.key))
            : "play.plan.assistant_make_failed";
        setErrorKey(key);
        navLinesRef.current = appendAssistantLine(navLinesRef.current, t(key));
        setNavStatusLines(navLinesRef.current);
      } finally {
        window.clearInterval(elapsedTimer);
        if (sawDone && !sawError) {
          setMakeElapsedMs(null);
        } else {
          setMakeElapsedMs(Date.now() - makeStartedAt);
        }
        setLoading(false);
      }
    },
    [locale, t, tripId, tripRevision],
  );

  function onTakeoffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setFieldErrors({});

    const parsed = validatePlanBoundaries({
      destination,
      days: Number(days),
      startDate,
      partySize: Number(partySize),
      budget,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors as TakeoffFieldErrors);
      return;
    }
    if (!budget.trim()) {
      setFieldErrors({ budget: "play.plan.error.budget_required" });
      return;
    }

    if (pagePhase === "intake" || pagePhase === "planning" || pagePhase === "done") {
      setReplanDialogVariant("replan");
      setPendingReplanAction(() => () => resetToBlankTakeoff());
      setReplanDialogOpen(true);
      return;
    }

    beginIntake();
  }

  function beginIntake() {
    resetPlanningState();
    setPagePhase("intake");
    setNavOpen(true);
    setIntakeStep(INTAKE_STEP_ORDER[0] ?? "b");
    setIntakeComplete(false);
    setIntakeAnswers({});
    setDiscoverLoading(true);
    setDiscoverSettled(false);
    discoverJobRef.current = runSilentDiscover();
  }

  const runSilentDiscover = useCallback(async () => {
    const fields = takeoff;
    try {
      const res = await authJson<{
        ok?: boolean;
        trip_id?: string;
        revision?: number;
      }>("/api/plan/discover", {
        method: "POST",
        body: JSON.stringify({
          destination: fields.destination,
          startDate: fields.startDate,
          days: fields.days,
          partySize: fields.partySize,
          budget: fields.budget,
          locale,
          max_number: 5,
        }),
      });
      if (res.trip_id) {
        setTripId(res.trip_id);
        tripIdRef.current = res.trip_id;
      }
      if (typeof res.revision === "number") {
        setTripRevision(res.revision);
        tripRevisionRef.current = res.revision;
      }
    } catch (err) {
      const body = err instanceof AuthApiError ? err.body : undefined;
      const tripFromErr =
        body && typeof body === "object" && "trip_id" in body
          ? (body as { trip_id?: string }).trip_id
          : undefined;
      if (typeof tripFromErr === "string" && tripFromErr) {
        setTripId(tripFromErr);
        tripIdRef.current = tripFromErr;
      }
    } finally {
      setDiscoverLoading(false);
      setDiscoverSettled(true);
    }
  }, [locale, takeoff]);

  const loadCandidatesFromTrip = useCallback(async () => {
    await discoverJobRef.current;
    if (!tripIdRef.current) {
      await runSilentDiscover();
    }
    const id = tripIdRef.current;
    if (!id) {
      setSuggestedMustSee([]);
      setDiscoverPool([]);
      return;
    }
    const res = await authJson<{
      iconic_places?: string[];
      pool?: DiscoverPoolRow[];
      revision?: number;
    }>("/api/plan/candidates", {
      method: "POST",
      body: JSON.stringify({
        trip_id: id,
        locale,
        days: takeoff.days,
        max_number: 5,
      }),
    });
    if (typeof res.revision === "number") {
      setTripRevision(res.revision);
      tripRevisionRef.current = res.revision;
    }
    setSuggestedMustSee(Array.isArray(res.iconic_places) ? res.iconic_places.slice(0, 5) : []);
    setDiscoverPool(Array.isArray(res.pool) ? res.pool : []);
  }, [locale, takeoff.days, runSilentDiscover]);

  useEffect(() => {
    if (intakeStep !== "g") return;
    let cancelled = false;
    setGCandidatesReady(false);
    void (async () => {
      try {
        await loadCandidatesFromTrip();
      } catch {
        if (!cancelled) {
          setSuggestedMustSee([]);
          setDiscoverPool([]);
        }
      } finally {
        if (!cancelled) setGCandidatesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intakeStep, loadCandidatesFromTrip]);

  async function onIntakeAnswer(step: IntakeStepId, value: string): Promise<boolean> {
    if (step === "b") setOriginLookupFailed(false);
    try {
      const res = await authJson<{
        ok?: boolean;
        revision?: number;
        originLat?: number;
        originLng?: number;
      }>("/api/plan/session", {
        method: "PATCH",
        body: JSON.stringify({
          step,
          value,
          locale,
          trip_id: tripIdRef.current,
          revision: tripRevision,
        }),
      });
      if (typeof res.revision === "number") {
        setTripRevision(res.revision);
        tripRevisionRef.current = res.revision;
      }
      if (step === "b") {
        if (typeof res.originLat === "number" && typeof res.originLng === "number") {
          setOriginLat(res.originLat);
          setOriginLng(res.originLng);
        } else {
          setOriginLat(undefined);
          setOriginLng(undefined);
        }
      }
      setIntakeAnswers((prev) => ({ ...prev, [step]: value }));
      const next = nextIntakeStep(step);
      setIntakeStep(next);
      return true;
    } catch (err) {
      if (err instanceof AuthApiError && err.key === "play.plan.intake_origin_not_found") {
        setOriginLookupFailed(true);
        return false;
      }
      setIntakeAnswers((prev) => ({ ...prev, [step]: value }));
      setIntakeStep(nextIntakeStep(step));
      return true;
    }
  }

  function onIntakeComplete(merged: IntakeAnswers) {
    setIntakeAnswers(merged);
    setIntakeStep(null);
    void (async () => {
      try {
        await loadCandidatesFromTrip();
      } catch {
        setSuggestedMustSee([]);
        setDiscoverPool([]);
      }
      setIntakeComplete(true);
      const boundaries = mergeIntakeToBoundaries(
        takeoff,
        merged,
        t,
        locale,
        suggestedMustSee.length ? suggestedMustSee : undefined,
      );
      const ctx = createPlanNarrativeContext({
        t,
        destination: takeoff.destination,
        days: takeoff.days,
        partySize: takeoff.partySize,
        tripType: boundaries.tripType,
      });
      narrativeCtxRef.current = ctx;
      navLinesRef.current = narrativeLinesForIntakeComplete(ctx);
      setNavStatusLines(navLinesRef.current);
      await runPlan({
        ...boundaries,
        tripId: tripIdRef.current,
        revision: tripRevisionRef.current,
        planMode: "skeleton",
        originLat,
        originLng,
      });
    })();
  }

  function onTerminateIntake() {
    resetToBlankTakeoff();
  }

  function confirmReplan() {
    setReplanDialogOpen(false);
    pendingReplanAction?.();
    setPendingReplanAction(null);
  }

  function cancelReplan() {
    setReplanDialogOpen(false);
    setPendingReplanAction(null);
  }

  function requestTerminateIntake() {
    setReplanDialogVariant("terminate");
    setPendingReplanAction(() => () => onTerminateIntake());
    setReplanDialogOpen(true);
  }

  function requestReplan() {
    setReplanDialogVariant("replan");
    setPendingReplanAction(() => () => resetToBlankTakeoff());
    setReplanDialogOpen(true);
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

  async function openPlaceSheet(slot: ItineraryPlaceSlot, dayIndex: number) {
    setPlaceSheetSlot(slot);
    setPlaceSheetDay(dayIndex);
    setPlaceDetails(null);
    setPlaceDetailsError(null);
    if (!slot.provider || !slot.nativeId) {
      setPlaceDetailsLoading(false);
      return;
    }
    setPlaceDetailsLoading(true);
    try {
      const data = await authJson<{ ok: boolean; data?: Record<string, unknown> }>(
        `/api/places/${encodeURIComponent(slot.provider)}/${encodeURIComponent(slot.nativeId)}?locale=${locale}`,
      );
      setPlaceDetails(data.data ?? null);
    } catch {
      setPlaceDetailsError("play.plan.place_sheet_error");
    } finally {
      setPlaceDetailsLoading(false);
    }
  }

  const phaseTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <main id="content" className="app-main" data-testid="plan-page">
      <h1 className="page-title">{t("play.plan.page_title")}</h1>

      <div className="plan-stack">
        {showTakeoff ? (
          <PlanTakeoffForm
            destination={destination}
            startDate={startDate}
            days={days}
            partySize={partySize}
            budget={budget}
            fieldErrors={fieldErrors}
            disabled={loading}
            onDestinationChange={setDestination}
            onStartDateChange={setStartDate}
            onDaysChange={setDays}
            onPartySizeChange={setPartySize}
            onBudgetChange={setBudget}
            onSubmit={onTakeoffSubmit}
          />
        ) : null}

        {showConstraints ? <PlanConstraintsPanel items={constraintItems} /> : null}

        {(pagePhase === "planning" || pagePhase === "done") && travelTips && takeoffIsValid(takeoff) ? (
            <PlanTravelTipsPanel
              destination={takeoff.destination}
              startDate={takeoff.startDate}
              days={takeoff.days}
              data={travelTips}
              loading={travelTipsLoading}
              errorKey={travelTipsError}
            />
        ) : null}

        {loading && planSubPhase !== "idle" ? (
          <p className="plan-phase is-busy" data-testid="plan-phase" role="status">
            <span className="plan-phase__meta" data-testid="plan-updated">
              {t("play.plan.phase_meta_skeleton", { time: phaseTime })}
            </span>
            <span className="plan-phase__msg">
              {genProgress || planSubPhase === "filling"
                ? t("play.plan.phase_msg_filling", {
                    current: String(genProgress?.current ?? focusDayIndex ?? 1),
                    total: String(genProgress?.total ?? (Number(days) || itinerary?.daysCount || 1)),
                  })
                : planSubPhase === "discovering"
                  ? t("play.plan.phase_discovering", { destination: destination || "…" })
                  : planSubPhase === "skeleton"
                    ? t("play.plan.phase_making")
                    : t("play.plan.phase_skeleton")}
            </span>
          </p>
        ) : null}

        <p className="error" role="alert" hidden={!errorKey} data-testid="plan-error">
          {errorKey ? t(errorKey) : ""}
        </p>

        {showItinerary && (itinerary || loading) ? (
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
            liveSlots={planSubPhase === "filling" ? liveSlots : []}
            showPending={loading && planSubPhase === "filling" && dayPending}
            generating={loading && (planSubPhase === "skeleton" || planSubPhase === "filling")}
            skeletonStops={displaySkeletonStops}
            slotPreviewText={slotPreviewText}
            saving={saving}
            onReplan={pagePhase === "done" || pagePhase === "planning" ? requestReplan : undefined}
            onSave={pagePhase === "done" ? () => void onSaveItinerary() : undefined}
            onOpenPlaceSheet={(slot, dayIndex) => void openPlaceSheet(slot, dayIndex)}
          />
        ) : null}

        {saveNoticeKey ? (
          <p className="plan-save-notice" role="status" data-testid="plan-save-notice">
            {t(saveNoticeKey)}
          </p>
        ) : null}

        <PlaceSheet
          open={placeSheetSlot != null}
          slot={placeSheetSlot}
          dayIndex={placeSheetDay ?? undefined}
          onClose={() => {
            setPlaceSheetSlot(null);
            setPlaceSheetDay(null);
            setPlaceDetails(null);
            setPlaceDetailsError(null);
          }}
          details={
            placeDetails as {
              name?: string;
              address?: string;
              rating?: number;
              photos?: string[];
              summary?: string;
            } | null
          }
          loading={placeDetailsLoading}
          errorKey={placeDetailsError}
        />

      </div>

      {pagePhase !== "idle" ? (
        <PlanAssistantNav
          open={navOpen}
          takeoff={takeoff}
          currentStep={intakeStep}
          answers={intakeAnswers}
          intakeComplete={intakeComplete || pagePhase === "planning" || pagePhase === "done"}
          skeletonDays={skeletonDays}
          statusLines={navStatusLines}
          suggestedMustSee={suggestedMustSee.length ? suggestedMustSee : undefined}
          mustSeeLoading={mustSeeLoading}
          makeElapsedSeconds={
            makeElapsedMs != null ? formatPlanElapsedSeconds(makeElapsedMs) : null
          }
          onOpen={() => setNavOpen(true)}
          onClose={() => setNavOpen(false)}
          onAnswer={onIntakeAnswer}
          originNotFound={originLookupFailed}
          onRetryOrigin={() => setOriginLookupFailed(false)}
          onTerminate={requestTerminateIntake}
          onComplete={onIntakeComplete}
        />
      ) : null}

      <ReplanDialog
        open={replanDialogOpen}
        variant={replanDialogVariant}
        onConfirm={confirmReplan}
        onCancel={cancelReplan}
      />
    </main>
  );
}
