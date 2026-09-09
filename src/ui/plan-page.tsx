"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItineraryDto, ItinerarySlot, PlanBoundaries } from "@/src/core/itinerary-types";
import {
  AGENT_NEED_TO_INTAKE_STEP,
  buildConstraintItems,
  intakeAnswersFromAgentNeeds,
  INTAKE_DEFAULT_VALUES,
  INTAKE_STEP_ORDER,
  mergeIntakeToBoundaries,
  nextIntakeStep,
  takeoffIsValid,
  takeoffToBoundaries,
  DEFAULT_TAKEOFF_TRIP_TYPE,
  type AgentNeedAnswers,
  type AgentNeedId,
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
import {
  buildFillRouteDays,
  type FillRouteDay,
} from "@/src/core/format-fill-timeline";
import {
  originNameFromPick,
  parseOriginPickIndex,
  sanitizeDailyStartName,
} from "@/src/core/plan-resolve-origin";
import { redoNeedState } from "@/src/core/plan-need-nav";
import { skeletonStopsForFocusedDay, patchSkeletonStopName } from "@/src/core/plan-skeleton-stops";
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
  tripType: string,
  pace: string,
  transit: string,
): TakeoffFields {
  return {
    destination,
    startDate,
    days: Number(days) || 1,
    partySize: Number(partySize) || 1,
    budget,
    tripType,
    pace,
    transit,
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
  const [tripType, setTripType] = useState(DEFAULT_TAKEOFF_TRIP_TYPE);
  const [pace, setPace] = useState("medium");
  const [transit, setTransit] = useState("transit_walk");
  const [needQuestions, setNeedQuestions] = useState<
    Array<{ id: string; prompt: string; options?: Array<{ id: string; label: string }>; multi?: boolean }>
  >([]);
  const [needIndex, setNeedIndex] = useState(0);
  const [needAnswers, setNeedAnswers] = useState<Record<string, string>>({});
  const [pagePhase, setPagePhase] = useState<PagePhase>("idle");
  const [navOpen, setNavOpen] = useState(false);
  const [intakeStep, setIntakeStep] = useState<IntakeStepId | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers>({});
  const [originLookupFailed, setOriginLookupFailed] = useState(false);
  const [originCandidates, setOriginCandidates] = useState<Array<{ name: string }>>([]);
  const [verifyingHotel, setVerifyingHotel] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
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
  const mustSeeSliceTriedRef = useRef(false);
  const [makeElapsedMs, setMakeElapsedMs] = useState<number | null>(null);

  const [skeletonDays, setSkeletonDays] = useState<SkeletonPreviewDay[]>([]);
  const [fillRouteDays, setFillRouteDays] = useState<FillRouteDay[]>([]);
  const [navStatusLines, setNavStatusLines] = useState<string[]>([]);
  const [planCompleteLine, setPlanCompleteLine] = useState<string | null>(null);

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
    () => takeoffFromState(destination, startDate, days, partySize, budget, tripType, pace, transit),
    [destination, startDate, days, partySize, budget, tripType, pace, transit],
  );

  const showTakeoff = pagePhase === "idle";
  const showConstraints = pagePhase !== "idle";
  const showItinerary = pagePhase === "planning" || pagePhase === "done" || Boolean(itinerary);

  const agentOnMustSee =
    needQuestions[needIndex]?.id === "must_see" &&
    !Object.prototype.hasOwnProperty.call(needAnswers, "must_see");
  const mustSeeLoading =
    ((intakeStep === "g" || agentOnMustSee) && !gCandidatesReady);

  const displaySkeletonStops = useMemo(() => {
    const dayIdx = focusDayIndex ?? itinerary?.days[0]?.dayIndex ?? 1;
    const committedPlaceCount =
      itinerary?.days
        .find((d) => d.dayIndex === dayIdx)
        ?.slots.filter((s) => s.kind === "place").length ?? 0;
    return skeletonStopsForFocusedDay(skeletonDays, focusDayIndex, liveSlots, planSubPhase, {
      committedPlaceCount,
    });
  }, [skeletonDays, focusDayIndex, liveSlots, planSubPhase, itinerary]);

  const constraintItems = useMemo(
    () =>
      buildConstraintItems(
        takeoff,
        { ...intakeAnswersFromAgentNeeds(needAnswers), ...intakeAnswers },
        t,
        intakeComplete || pagePhase === "planning" || pagePhase === "done",
        suggestedMustSee.length ? suggestedMustSee : undefined,
      ),
    [takeoff, intakeAnswers, needAnswers, t, intakeComplete, pagePhase, suggestedMustSee],
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
          if (c.tripType?.trim()) setTripType(c.tripType.trim());
          if (c.pace?.trim()) setPace(c.pace.trim());
          if (c.transport?.trim()) setTransit(c.transport.trim());
          if (typeof c.tripId === "string") {
            setTripId(c.tripId);
            tripIdRef.current = c.tripId;
          }
          if (typeof c.revision === "number") {
            setTripRevision(c.revision);
            tripRevisionRef.current = c.revision;
          }
          const hotel = sanitizeDailyStartName(c.dailyStart);
          if (hotel) {
            setIntakeAnswers((prev) => ({ ...prev, b: hotel }));
          }
          if (typeof c.originLat === "number") setOriginLat(c.originLat);
          if (typeof c.originLng === "number") setOriginLng(c.originLng);
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
    setFillRouteDays([]);
    setNavStatusLines([]);
    setPlanCompleteLine(null);
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
      setFillRouteDays([]);
      setPlanCompleteLine(null);
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
            stopIndex?: number;
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
              if (result.completeLine !== undefined) {
                setPlanCompleteLine(result.completeLine);
              }
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
              applyNarrative(event);
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
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              setLiveSlots((prev) => [...prev, event.slot!]);
              setDayPending(true);
              setSlotPreviewText(null);
              if (event.dayIndex != null) setFocusDayIndex(event.dayIndex);
              const filled = event.slot;
              if (
                filled.kind === "place" &&
                typeof event.stopIndex === "number" &&
                event.dayIndex != null
              ) {
                const placeName = filled.name?.trim();
                if (placeName) {
                  setSkeletonDays((prev) =>
                    patchSkeletonStopName(prev, event.dayIndex!, event.stopIndex!, placeName),
                  );
                }
                // Thumbs come from agent-resolved photos[0] (ADR-051); do not details-backfill.
              }
              applyNarrative(event);
            } else if (event.type === "day_done" && event.itinerary) {
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              setLiveSlots([]);
              setDayPending(false);
              setSlotPreviewText(null);
              if (event.dayIndex != null && event.daysTotal != null) {
                setGenProgress({ current: event.dayIndex, total: event.daysTotal });
              }
              applyNarrative(event);
            } else if (event.type === "done" && event.itinerary) {
              sawDone = true;
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              setPagePhase("done");
              setGenProgress(null);
              setPlanSubPhase(criteria.planMode === "skeleton" ? "skeleton" : "idle");
              setLiveSlots([]);
              setDayPending(false);
              setFocusDayIndex(null);
              // Clear transit/slot preview residue; keep skeletonDays for assistant spine (ui-B).
              // Main panel day-bottom outline is gated by idle → [] in skeletonStopsForFocusedDay.
              setSlotPreviewText(null);
              applyNarrative(event);
            } else if (event.type === "error") {
              sawError = event.key ?? "errors.provider_failed";
              console.error("plan stream error", event.key, "detail" in event ? event.detail : undefined);
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
    setIntakeStep(null);
    setIntakeComplete(false);
    setIntakeAnswers({});
    setNeedQuestions([]);
    setNeedIndex(0);
    setNeedAnswers({});
    setVerifyingHotel(false);
    setDiscoverLoading(true);
    setDiscoverSettled(false);
    discoverJobRef.current = runPlanTripIntake();
  }

  const runPlanTripIntake = useCallback(async () => {
    const fields = takeoff;
    try {
      const res = await authJson<{
        ok?: boolean;
        trip_id?: string;
        revision?: number;
        status?: string;
        need_input?: {
          questions: Array<{
            id: string;
            prompt: string;
            options?: Array<{ id: string; label: string }>;
            multi?: boolean;
          }>;
        };
      }>("/api/plan/trip", {
        method: "POST",
        body: JSON.stringify({
          city: fields.destination,
          startDate: fields.startDate,
          days: fields.days,
          partySize: fields.partySize,
          budget: fields.budget,
          tripType: fields.tripType?.trim() || t("play.plan.trip_type.couple_romance"),
          pace: fields.pace === "tight" || fields.pace === "relaxed" ? fields.pace : "medium",
          transit: fields.transit === "drive_walk" ? "drive_walk" : "transit_walk",
          locale,
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
      const qs = res.need_input?.questions ?? [];
      setNeedQuestions(qs);
      if (!qs.length) {
        setIntakeStep("b");
      }
      const chips = qs.find((q) => q.id === "must_see")?.options?.map((o) => o.label) ?? [];
      if (chips.length) setSuggestedMustSee(chips);
    } catch (err) {
      const key =
        err instanceof AuthApiError
          ? resolveErrorKey(err.key)
          : "play.errors.provider_failed";
      setErrorKey(key);
    } finally {
      setDiscoverLoading(false);
      setDiscoverSettled(true);
    }
  }, [locale, takeoff, t]);

  const runSilentDiscover = useCallback(async () => {
    const fields = takeoff;
    const id = tripIdRef.current;
    if (!id) {
      setDiscoverLoading(false);
      setDiscoverSettled(true);
      return;
    }
    try {
      const res = await authJson<{
        ok?: boolean;
        trip_id?: string;
        revision?: number;
      }>("/api/plan/candidates", {
        method: "POST",
        body: JSON.stringify({
          trip_id: id,
          locale,
          days: fields.days,
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
    } catch {
      /* chips remain from plan_trip need_input */
    } finally {
      setDiscoverLoading(false);
      setDiscoverSettled(true);
    }
  }, [locale, takeoff]);

  const loadCandidatesFromTrip = useCallback(async (): Promise<string[]> => {
    await discoverJobRef.current;
    if (!tripIdRef.current) {
      await runSilentDiscover();
    }
    const id = tripIdRef.current;
    if (!id) {
      setSuggestedMustSee([]);
      setDiscoverPool([]);
      return [];
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
        max_number: 8,
      }),
    });
    if (typeof res.revision === "number") {
      setTripRevision(res.revision);
      tripRevisionRef.current = res.revision;
    }
    const chips = Array.isArray(res.iconic_places) ? res.iconic_places.slice(0, 8) : [];
    setSuggestedMustSee(chips);
    setDiscoverPool(Array.isArray(res.pool) ? res.pool : []);
    if (chips.length) {
      setNeedQuestions((prev) =>
        prev.map((q) =>
          q.id === "must_see"
            ? {
                ...q,
                options: chips.map((label, i) => ({ id: `ms_${i}`, label })),
              }
            : q,
        ),
      );
    }
    return chips;
  }, [locale, takeoff.days, runSilentDiscover]);

  const retryMustSee = useCallback(async () => {
    mustSeeSliceTriedRef.current = true;
    setGCandidatesReady(false);
    try {
      await loadCandidatesFromTrip();
    } catch {
      setSuggestedMustSee([]);
      setDiscoverPool([]);
    } finally {
      setGCandidatesReady(true);
    }
  }, [loadCandidatesFromTrip]);

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

  // Agent Q3: when must_see has no options, try trip slice once (empty → hand-type / refetch).
  useEffect(() => {
    const q = needQuestions[needIndex];
    if (q?.id !== "must_see") {
      mustSeeSliceTriedRef.current = false;
      return;
    }
    // Takeoff already delivered chips (options or suggestedMustSee): candidates are ready.
    if ((q.options?.length ?? 0) > 0 || suggestedMustSee.length > 0) {
      setGCandidatesReady(true);
      return;
    }
    if (mustSeeSliceTriedRef.current) return;
    if (!tripIdRef.current) return;
    mustSeeSliceTriedRef.current = true;
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
  }, [needIndex, needQuestions, suggestedMustSee.length, loadCandidatesFromTrip]);

  async function onIntakeAnswer(step: IntakeStepId, value: string): Promise<boolean> {
    if (step === "b") {
      setOriginLookupFailed(false);
      if (!value.startsWith("__origin_pick__:")) {
        setOriginCandidates([]);
        setOriginQuery(value.trim());
      }
    }
    try {
      const res = await authJson<{
        ok?: boolean;
        revision?: number;
        originLat?: number;
        originLng?: number;
        origin_name?: string;
        origin_candidates?: Array<{ name: string; lat?: number; lng?: number }>;
        stay_on_step?: boolean;
      }>("/api/plan/session", {
        method: "PATCH",
        body: JSON.stringify({
          step,
          value,
          locale,
          destination: takeoff.destination,
          trip_id: tripIdRef.current,
          revision: tripRevision,
        }),
      });
      if (typeof res.revision === "number") {
        setTripRevision(res.revision);
        tripRevisionRef.current = res.revision;
      }
      if (step === "b" && res.stay_on_step && res.origin_candidates?.length) {
        setOriginCandidates(res.origin_candidates.map((c) => ({ name: c.name })));
        setOriginLookupFailed(false);
        return false;
      }
      if (step === "b") {
        setOriginCandidates([]);
        if (typeof res.originLat === "number" && typeof res.originLng === "number") {
          setOriginLat(res.originLat);
          setOriginLng(res.originLng);
        } else {
          setOriginLat(undefined);
          setOriginLng(undefined);
        }
      }
      const fromChip = originNameFromPick(value, originCandidates);
      const stored =
        step === "b"
          ? fromChip ||
            (typeof res.origin_name === "string" ? res.origin_name : "") ||
            (parseOriginPickIndex(value) != null ? "" : value)
          : value;
      setIntakeAnswers((prev) => ({ ...prev, [step]: stored }));
      const next = nextIntakeStep(step);
      setIntakeStep(next);
      return true;
    } catch (err) {
      // S7: never advance past step b on origin lookup / session errors.
      if (step === "b") {
        if (err instanceof AuthApiError && err.key === "play.plan.intake_origin_not_found") {
          setOriginLookupFailed(true);
          setOriginCandidates([]);
          return false;
        }
        // Stale cookie / CSRF used to fail silently here (PATCH 401/403 → "no reaction").
        if (err instanceof AuthApiError) {
          setErrorKey(resolveErrorKey(err.key));
          if (err.key === "errors.session_expired" || err.key === "errors.csrf") {
            window.location.assign("/login");
          }
          return false;
        }
        setErrorKey("play.errors.network");
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
      // ADR-051: do not treat details photos as a second thumb truth source.
      setPlaceDetails(data.data ?? null);
    } catch {
      setPlaceDetailsError("play.plan.place_sheet_error");
    } finally {
      setPlaceDetailsLoading(false);
    }
  }

  const placeSheetHowToArrive = (() => {
    if (!placeSheetSlot || placeSheetDay == null || !itinerary) return null;
    const day = itinerary.days.find((d) => d.dayIndex === placeSheetDay);
    if (!day) return null;
    const idx = day.slots.findIndex(
      (s) =>
        s.kind === "place" &&
        s.nativeId === placeSheetSlot.nativeId &&
        s.provider === placeSheetSlot.provider &&
        s.name === placeSheetSlot.name,
    );
    if (idx <= 0) return null;
    const prev = day.slots[idx - 1];
    return prev?.kind === "transit" ? prev.text : null;
  })();

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
            tripType={tripType}
            pace={pace}
            transit={transit}
            fieldErrors={fieldErrors}
            disabled={loading}
            onDestinationChange={setDestination}
            onStartDateChange={setStartDate}
            onDaysChange={setDays}
            onPartySizeChange={setPartySize}
            onBudgetChange={setBudget}
            onTripTypeChange={setTripType}
            onPaceChange={setPace}
            onTransitChange={setTransit}
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
          howToArrive={placeSheetHowToArrive}
          onClose={() => {
            setPlaceSheetSlot(null);
            setPlaceSheetDay(null);
            setPlaceDetails(null);
            setPlaceDetailsError(null);
          }}
          details={placeDetails as import("@/src/ui/place-sheet").PlaceDetails | null}
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
          fillingLocked={
            loading ||
            mustSeeLoading ||
            travelTipsLoading
          }
          skeletonDays={skeletonDays}
          fillRouteDays={fillRouteDays}
          statusLines={navStatusLines}
          planCompleteLine={planCompleteLine}
          suggestedMustSee={suggestedMustSee.length ? suggestedMustSee : undefined}
          mustSeeLoading={mustSeeLoading}
          onRetryMustSee={retryMustSee}
          makeElapsedSeconds={
            makeElapsedMs != null ? formatPlanElapsedSeconds(makeElapsedMs) : null
          }
          onOpen={() => setNavOpen(true)}
          onClose={() => setNavOpen(false)}
          onAnswer={onIntakeAnswer}
          originNotFound={originLookupFailed}
          originCandidates={originCandidates.length ? originCandidates : undefined}
          originQuery={originQuery}
          onRetryOrigin={() => {
            setOriginLookupFailed(false);
            setOriginCandidates([]);
          }}
          onTerminate={requestTerminateIntake}
          onComplete={onIntakeComplete}
          agentNeedQuestions={needQuestions.length ? needQuestions : undefined}
          agentNeedIndex={needIndex}
          agentNeedAnswers={needAnswers}
          awaitingAgentNeeds={
            pagePhase === "intake" &&
            !intakeComplete &&
            needQuestions.length === 0 &&
            discoverLoading
          }
          verifyingHotel={verifyingHotel}
          canRedoNeed={needIndex > 0}
          onAgentNeedRedo={() => {
            const next = redoNeedState(
              needQuestions.map((q) => ({ id: q.id as AgentNeedId })),
              needIndex,
              needAnswers,
            );
            setNeedIndex(next.index);
            setNeedAnswers(next.answers);
          }}
          canRedoLocal={
            Boolean(intakeStep && INTAKE_STEP_ORDER.indexOf(intakeStep) > 0)
          }
          onLocalNeedSkip={() => {
            if (!intakeStep) return;
            void onIntakeAnswer(
              intakeStep,
              intakeStep === "b" ? "" : INTAKE_DEFAULT_VALUES[intakeStep],
            );
          }}
          onLocalNeedRedo={() => {
            if (!intakeStep) return;
            const idx = INTAKE_STEP_ORDER.indexOf(intakeStep);
            if (idx <= 0) return;
            const prev = INTAKE_STEP_ORDER[idx - 1]!;
            setIntakeAnswers((prevAns) => {
              const copy = { ...prevAns };
              delete copy[intakeStep];
              delete copy[prev];
              return copy;
            });
            setIntakeStep(prev);
          }}
          onAgentNeedAnswer={(id, value) => {
            void (async () => {
              const needId = id as AgentNeedId;
              const step = AGENT_NEED_TO_INTAKE_STEP[needId];
              let stored = value;
              if (needId === "hotel") {
                setOriginQuery(value.trim());
              }
              if (step) {
                const skipHotelVerify = needId === "hotel" && !value.trim();
                const shouldVerifyHotel = needId === "hotel" && Boolean(value.trim());
                const isPick = parseOriginPickIndex(value.trim()) != null;
                if (needId === "hotel" && shouldVerifyHotel && !isPick) {
                  setOriginCandidates([]);
                  setOriginLookupFailed(false);
                  setErrorKey(null);
                  setNeedQuestions((prev) =>
                    prev.map((q) => (q.id === "hotel" ? { ...q, options: undefined } : q)),
                  );
                  setVerifyingHotel(true);
                }
                try {
                  const res = await authJson<{
                    originLat?: number;
                    originLng?: number;
                    origin_name?: string;
                    origin_candidates?: Array<{ name: string }>;
                    stay_on_step?: boolean;
                  }>("/api/plan/session", {
                    method: "PATCH",
                    body: JSON.stringify({
                      step,
                      value: skipHotelVerify ? "" : value,
                      locale,
                      destination: takeoff.destination,
                      trip_id: tripIdRef.current,
                      revision: tripRevision,
                    }),
                  });
                  if (needId === "hotel" && res.stay_on_step && res.origin_candidates?.length) {
                    setOriginCandidates(res.origin_candidates.map((c) => ({ name: c.name })));
                    setNeedQuestions((prev) =>
                      prev.map((q) =>
                        q.id === "hotel"
                          ? {
                              ...q,
                              options: res.origin_candidates!.map((c, i) => ({
                                id: `cand_${i}`,
                                label: c.name,
                              })),
                            }
                          : q,
                      ),
                    );
                    return;
                  }
                  if (needId === "hotel") {
                    setOriginCandidates([]);
                    setOriginLookupFailed(false);
                    if (typeof res.originLat === "number") setOriginLat(res.originLat);
                    if (typeof res.originLng === "number") setOriginLng(res.originLng);
                    const isPick = parseOriginPickIndex(value.trim()) != null;
                    if (typeof res.origin_name === "string") {
                      stored = res.origin_name;
                    } else if (isPick) {
                      stored = originNameFromPick(value, originCandidates) || value;
                    }
                  }
                } catch (err) {
                  if (needId === "hotel" && value.trim()) {
                    if (err instanceof AuthApiError && err.key === "play.plan.intake_origin_not_found") {
                      setOriginLookupFailed(true);
                      setOriginCandidates([]);
                      setNeedQuestions((prev) =>
                        prev.map((q) => (q.id === "hotel" ? { ...q, options: undefined } : q)),
                      );
                      return;
                    }
                    if (err instanceof AuthApiError) {
                      setErrorKey(resolveErrorKey(err.key));
                      if (err.key === "errors.session_expired" || err.key === "errors.csrf") {
                        window.location.assign("/login");
                      }
                      return;
                    }
                    setErrorKey("play.errors.network");
                    return;
                  }
                } finally {
                  setVerifyingHotel(false);
                }
              }
              const nextAnswers: AgentNeedAnswers = { ...needAnswers, [needId]: stored };
              setNeedAnswers(nextAnswers);
              if (needIndex + 1 < needQuestions.length) {
                setNeedIndex(needIndex + 1);
                return;
              }
              setIntakeComplete(true);
              const chips = nextAnswers.must_see;
              if (chips) {
                setSuggestedMustSee(chips.split(/[,，、]/).map((s) => s.trim()).filter(Boolean));
              }
              try {
                await loadCandidatesFromTrip();
              } catch {
                setSuggestedMustSee((prev) => prev);
                setDiscoverPool([]);
              }
              const boundaries = takeoffToBoundaries(takeoff, nextAnswers, t, locale);
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
            })();
          }}
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
