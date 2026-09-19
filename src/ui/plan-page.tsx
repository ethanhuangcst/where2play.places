"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItineraryDto, ItinerarySlot, PlanBoundaries } from "@/src/core/itinerary-types";
import {
  buildConstraintItems,
  intakeAnswersFromAgentNeeds,
  mergeIntakeToBoundaries,
  nextOpenIntakeStep,
  takeoffIsValid,
  DEFAULT_TAKEOFF_TRIP_TYPE,
  formatTripTypeDisplay,
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
import { isResolvablePlaceNativeId } from "@/src/core/place-native-id";
import {
  buildFillRouteDays,
  type FillRouteDay,
} from "@/src/core/format-fill-timeline";
import {
  originNameFromPick,
  parseOriginPickIndex,
  sanitizeDailyStartName,
} from "@/src/core/plan-resolve-origin";
import { skeletonStopsForFocusedDay, patchSkeletonStopName } from "@/src/core/plan-skeleton-stops";
import {
  hydrateFromAgentSkeleton,
  t3ProgressStepStates,
  type SkeletonDeviation,
} from "@/src/core/plan-t3-hydrate";
import { validatePlanBoundaries } from "@/src/core/plan-validate";
import { itineraryHasFilledPlaceSlots as itineraryHasFilledSlots } from "@/src/core/plan-itinerary-draft";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson, authNdjsonEvents, AuthApiError } from "@/src/ui/auth-api";
import { SKELETON_HOLD_BEFORE_FILL_MS } from "@/src/core/plan-assistant-thread";
import { PlanAssistantNav, type SkeletonPreviewDay } from "@/src/ui/plan-assistant-nav";
import { PlanConstraintsPanel } from "@/src/ui/plan-constraints-panel";
import { PlanItineraryView } from "@/src/ui/plan-itinerary-view";
import { PlanTakeoffForm, type TakeoffFieldErrors, type OriginOverlayState } from "@/src/ui/plan-takeoff-form";
import { formatDestVerifiedLabel } from "@/src/core/plan-dest-label";
import { PlanTravelTipsPanel, type TravelTipsData } from "@/src/ui/plan-travel-tips-panel";
import { PlaceSheet } from "@/src/ui/place-sheet";
import { ReplanDialog } from "@/src/ui/replan-dialog";
import { usePageTitle } from "@/src/ui/use-page-title";
import type { ItineraryPlaceSlot } from "@/src/core/itinerary-types";
import type { DiscoverPoolRow } from "@/src/core/plan-discover-pool";
type PagePhase = "idle" | "intake" | "progress" | "planning" | "done";
type PlanSubPhase = "discovering" | "skeleton" | "filling" | "idle";

type PlanCurrentResponse = {
  ok: boolean;
  criteria: PlanBoundaries | null;
  itinerary: ItineraryDto | null;
  skeleton?: unknown;
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
  const [startTime, setStartTime] = useState("09:00");
  const [origin, setOrigin] = useState("");
  const [other, setOther] = useState("");
  const [destVerified, setDestVerified] = useState<{
    country: string;
    city: string;
    city_en?: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [destVerifying, setDestVerifying] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const pendingSubmitConfirmRef = useRef(false);
  const [originOverlay, setOriginOverlay] = useState<OriginOverlayState>(null);
  const [originResolving, setOriginResolving] = useState(false);
  const [focusOriginToken, setFocusOriginToken] = useState(0);
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
  const [originStay, setOriginStay] = useState<PlanBoundaries["originStay"] | undefined>();
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
  const runFillFromSkeletonRef = useRef<((criteria: PlanBoundaries) => Promise<void>) | null>(null);
  const mustSeeSliceTriedRef = useRef(false);
  const [makeElapsedMs, setMakeElapsedMs] = useState<number | null>(null);

  const [skeletonDays, setSkeletonDays] = useState<SkeletonPreviewDay[]>([]);
  const [skeletonDeviations, setSkeletonDeviations] = useState<SkeletonDeviation[]>([]);
  const [fillRouteDays, setFillRouteDays] = useState<FillRouteDay[]>([]);
  const [navStatusLines, setNavStatusLines] = useState<string[]>([]);
  const [t3Phases, setT3Phases] = useState<Array<{ phase: string }>>([]);
  const [frameworkReadyLine, setFrameworkReadyLine] = useState<string | null>(null);
  const [fillBeginLine, setFillBeginLine] = useState<string | null>(null);
  const [planCompleteLine, setPlanCompleteLine] = useState<string | null>(null);
  const fillHoldTimerRef = useRef<number | null>(null);

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

  const destVerifiedLabel = useMemo(
    () =>
      destVerified
        ? formatDestVerifiedLabel({
            country: destVerified.country,
            city: destVerified.city,
            city_en: destVerified.city_en,
          })
        : null,
    [destVerified],
  );

  const takeoffSubmitEnabled = useMemo(() => {
    if (!destVerified || destVerifying || originResolving || originOverlay) return false;
    if (!destination.trim() || !startDate.trim() || !budget.trim()) return false;
    if (!tripType.trim() || !pace.trim() || !transit.trim()) return false;
    if (!(startTime.trim() || "09:00")) return false;
    const d = Number(days);
    const p = Number(partySize);
    if (!Number.isInteger(d) || d < 1 || d > 14) return false;
    if (!Number.isInteger(p) || p < 1 || p > 20) return false;
    return true;
  }, [
    destVerified,
    destVerifying,
    originResolving,
    originOverlay,
    destination,
    startDate,
    budget,
    tripType,
    pace,
    transit,
    startTime,
    days,
    partySize,
  ]);

  const onDestinationChange = useCallback((v: string) => {
    setDestination(v);
    setDestVerified(null);
    setFieldErrors((prev) => {
      if (!prev.destination) return prev;
      const next = { ...prev };
      delete next.destination;
      return next;
    });
  }, []);

  const onDestinationBlur = useCallback(async () => {
    const q = destination.trim();
    if (!q) {
      setDestVerified(null);
      return;
    }
    setDestVerifying(true);
    try {
      const res = await authJson<{
        ok?: boolean;
        country?: string;
        city?: string;
        city_en?: string;
        lat?: number;
        lng?: number;
        error?: { key?: string };
      }>("/api/geocode", {
        method: "POST",
        body: JSON.stringify({ query: q, locale }),
      });
      if (!res.ok || !res.country || !res.city || res.lat == null || res.lng == null) {
        setDestVerified(null);
        setFieldErrors((prev) => ({
          ...prev,
          destination: "play.plan.dest_geocode_failed",
        }));
        return;
      }
      setDestVerified({
        country: res.country,
        city: res.city,
        ...(res.city_en ? { city_en: res.city_en } : {}),
        lat: res.lat,
        lng: res.lng,
      });
      setFieldErrors((prev) => {
        if (!prev.destination) return prev;
        const next = { ...prev };
        delete next.destination;
        return next;
      });
    } catch {
      setDestVerified(null);
      setFieldErrors((prev) => ({
        ...prev,
        destination: "play.plan.dest_geocode_failed",
      }));
    } finally {
      setDestVerifying(false);
    }
  }, [destination, locale]);

  const onOriginChange = useCallback((v: string) => {
    setOrigin(v);
  }, []);

  const onOriginBlur = useCallback(
    async (rawValue?: string) => {
      const q = (rawValue ?? origin).trim();
      const dest = destination.trim();
      // Sync controlled state from the live input so submit / next blur see the same text.
      if (rawValue !== undefined && rawValue !== origin) {
        setOrigin(rawValue);
      }
      if (!q || !dest) {
        setOriginOverlay(null);
        return;
      }
      setOriginResolving(true);
      try {
        const res = await authJson<{
          ok?: boolean;
          kind?: string;
          name?: string;
          lat?: number;
          lng?: number;
          provider?: string;
          native_id?: string;
          photos?: string[];
          cards?: Array<{ name: string; lat?: number; lng?: number; provider?: string; native_id?: string }>;
        }>("/api/plan/resolve-origin", {
          method: "POST",
          body: JSON.stringify({ query: q, destination: dest, locale }),
        });
        if (res.kind === "hit" && res.name && typeof res.lat === "number" && typeof res.lng === "number") {
          setOrigin(res.name);
          setOriginLat(res.lat);
          setOriginLng(res.lng);
          setOriginStay({
            name: res.name,
            lat: res.lat,
            lng: res.lng,
            ...(res.provider ? { provider: res.provider } : {}),
            ...(res.native_id ? { native_id: res.native_id } : {}),
            ...(Array.isArray(res.photos) && res.photos.length ? { photos: res.photos.slice(0, 1) } : {}),
          });
          setOriginOverlay(null);
          return;
        }
        if (res.kind === "candidates" && res.cards?.length) {
          setOriginOverlay({
            kind: "candidates",
            query: q,
            destination: dest,
            cards: res.cards,
          });
          return;
        }
        if (res.kind === "skip") {
          setOriginOverlay(null);
          return;
        }
        setOriginOverlay({ kind: "not_found", query: q, destination: dest });
      } catch {
        setOriginOverlay({ kind: "not_found", query: q, destination: dest });
      } finally {
        setOriginResolving(false);
      }
    },
    [origin, destination, locale],
  );

  const onOriginPick = useCallback(
    (index: number) => {
      if (!originOverlay || originOverlay.kind !== "candidates") return;
      const card = originOverlay.cards[index];
      if (!card) return;
      const dest = destination.trim();
      setOriginResolving(true);
      void (async () => {
        try {
          // Re-resolve pick so ADR-053 photos/native_id land on originStay.
          const res = await authJson<{
            ok?: boolean;
            kind?: string;
            name?: string;
            lat?: number;
            lng?: number;
            provider?: string;
            native_id?: string;
            photos?: string[];
          }>("/api/plan/resolve-origin", {
            method: "POST",
            body: JSON.stringify({ query: card.name, destination: dest, locale }),
          });
          if (res.kind === "hit" && res.name && typeof res.lat === "number" && typeof res.lng === "number") {
            setOrigin(res.name);
            setOriginLat(res.lat);
            setOriginLng(res.lng);
            setOriginStay({
              name: res.name,
              lat: res.lat,
              lng: res.lng,
              ...(res.provider ? { provider: res.provider } : {}),
              ...(res.native_id ? { native_id: res.native_id } : {}),
              ...(Array.isArray(res.photos) && res.photos.length ? { photos: res.photos.slice(0, 1) } : {}),
            });
          } else {
            setOrigin(card.name);
            if (typeof card.lat === "number" && typeof card.lng === "number") {
              setOriginLat(card.lat);
              setOriginLng(card.lng);
              setOriginStay({
                name: card.name,
                lat: card.lat,
                lng: card.lng,
                ...(card.provider ? { provider: card.provider } : {}),
                ...(card.native_id ? { native_id: card.native_id } : {}),
              });
            } else {
              setOriginStay(undefined);
            }
          }
          setOriginOverlay(null);
          if (pendingSubmitConfirmRef.current) {
            pendingSubmitConfirmRef.current = false;
            setSubmitConfirmOpen(true);
          }
        } catch {
          setOrigin(card.name);
          setOriginStay(undefined);
          setOriginOverlay(null);
        } finally {
          setOriginResolving(false);
        }
      })();
    },
    [originOverlay, destination, locale],
  );

  const onOriginRetry = useCallback(() => {
    pendingSubmitConfirmRef.current = false;
    setSubmitConfirmOpen(false);
    setOrigin("");
    setOriginOverlay(null);
    setFocusOriginToken((n) => n + 1);
  }, []);

  const onOriginSkip = useCallback(() => {
    setOrigin("");
    setOriginOverlay(null);
    if (pendingSubmitConfirmRef.current) {
      pendingSubmitConfirmRef.current = false;
      setSubmitConfirmOpen(true);
    }
  }, []);

  const onSubmitConfirmCancel = useCallback(() => {
    pendingSubmitConfirmRef.current = false;
    setSubmitConfirmOpen(false);
  }, []);


  const showTakeoff = pagePhase === "idle";
  const showConstraints = pagePhase !== "idle";
  const showItinerary =
    pagePhase === "planning" ||
    pagePhase === "done" ||
    pagePhase === "progress" ||
    Boolean(itinerary);
  const t3Mode =
    pagePhase === "planning" ||
    pagePhase === "progress" ||
    (pagePhase === "done" && t3Phases.length > 0);

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
    const stops = skeletonStopsForFocusedDay(
      skeletonDays,
      focusDayIndex,
      liveSlots,
      // T3 ready keeps outline visible with all stops marked filled.
      t3Mode && pagePhase === "done" ? "skeleton" : planSubPhase,
      { committedPlaceCount },
    );
    if (t3Mode && pagePhase === "done") {
      return stops.map((s) => ({ ...s, filled: true, pending: false }));
    }
    return stops;
  }, [skeletonDays, focusDayIndex, liveSlots, planSubPhase, itinerary, t3Mode, pagePhase]);

  const t3ProgressSteps = useMemo(
    () => t3ProgressStepStates(t3Phases, { failed: Boolean(errorKey) }),
    [t3Phases, errorKey],
  );

  const constraintItems = useMemo(
    () =>
      buildConstraintItems(
        takeoff,
        { ...intakeAnswersFromAgentNeeds(needAnswers), ...intakeAnswers },
        t,
        intakeComplete ||
          pagePhase === "planning" ||
          pagePhase === "done" ||
          pagePhase === "progress",
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
            setOrigin(hotel);
            setIntakeAnswers((prev) => ({ ...prev, b: hotel }));
          }
          if (typeof c.originLat === "number") setOriginLat(c.originLat);
          if (typeof c.originLng === "number") setOriginLng(c.originLng);
        }
        if (data.itinerary) {
          setItinerary(data.itinerary);
          setPagePhase("done");
          if (itineraryHasFilledSlots(data.itinerary)) {
            const c = data.criteria;
            setT3Phases([{ phase: "skeleton_generating" }, { phase: "skeleton_ready" }]);
            setIntakeComplete(true);
            setIntakeStep(null);
            setFillRouteDays(buildFillRouteDays(data.itinerary, t, { includeTransit: true }));
            const tripTypeLabel =
              formatTripTypeDisplay(c?.tripType ?? tripType, t) ||
              c?.tripType?.trim() ||
              t("play.plan.constraint_none");
            setPlanCompleteLine(
              t("play.plan.assistant_plan_complete", {
                destination: c?.destination ?? data.itinerary.destination,
                days: String(c?.days ?? data.itinerary.daysCount),
                party: String(c?.partySize ?? (Number(partySize) || 2)),
                tripType: tripTypeLabel,
              }),
            );
            if (data.skeleton && c) {
              const hydrated = hydrateFromAgentSkeleton(c, data.skeleton, t);
              if (hydrated) {
                setSkeletonDays(hydrated.skeletonDays);
                setSkeletonDeviations(hydrated.deviations);
                setFrameworkReadyLine(
                  t("play.plan.assistant_framework_ready", {
                    destination: c.destination,
                    days: String(c.days),
                    partySize: String(c.partySize ?? 2),
                    tripType: tripTypeLabel,
                  }),
                );
                setFillBeginLine(t("play.plan.assistant_fill_begin"));
              }
            }
            setNavOpen(true);
          }
        }
      } catch {
        /* empty plan ok */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
      if (fillHoldTimerRef.current != null) {
        window.clearTimeout(fillHoldTimerRef.current);
        fillHoldTimerRef.current = null;
      }
    };
  }, []);

  const clearFillHoldTimer = useCallback(() => {
    if (fillHoldTimerRef.current != null) {
      window.clearTimeout(fillHoldTimerRef.current);
      fillHoldTimerRef.current = null;
    }
  }, []);

  const resetPlanningState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearFillHoldTimer();
    setItinerary(null);
    setLoading(false);
    setPlanSubPhase("idle");
    setGenProgress(null);
    setLiveSlots([]);
    setFocusDayIndex(null);
    setDayPending(false);
    setSkeletonDays([]);
    setSkeletonDeviations([]);
    setFillRouteDays([]);
    setNavStatusLines([]);
    setPlanCompleteLine(null);
    setT3Phases([]);
    setFrameworkReadyLine(null);
    setFillBeginLine(null);
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
  }, [clearFillHoldTimer]);

  const resetToBlankTakeoff = useCallback(() => {
    resetPlanningState();
    setDestination("");
    setStartDate(defaultStartDate());
    setDays("3");
    setPartySize("2");
    setBudget("mid");
    setTripType(DEFAULT_TAKEOFF_TRIP_TYPE);
    setPace("medium");
    setTransit("transit_walk");
    setStartTime("09:00");
    setOrigin("");
    setOther("");
    setDestVerified(null);
    setOriginOverlay(null);
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
      const controller = new AbortController();
      abortRef.current = controller;
      const abortTimer = window.setTimeout(() => controller.abort(), 300_000);
      setLiveSlots([]);
      setFocusDayIndex(null);
      setSkeletonDays([]);
      setSkeletonDeviations([]);
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
            signal: controller.signal,
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

            if (event.type === "ledger") {
              const ledgerEv = event as { tripId?: string; revision?: number };
              if (typeof ledgerEv.revision === "number") {
                setTripRevision(ledgerEv.revision);
                tripRevisionRef.current = ledgerEv.revision;
              }
              if (typeof ledgerEv.tripId === "string") {
                setTripId(ledgerEv.tripId);
                tripIdRef.current = ledgerEv.tripId;
              }
            } else if (event.type === "tips" && event.data) {
              setTravelTips(event.data);
              setTravelTipsLoading(false);
              setTravelTipsError(null);
            } else if (event.type === "phase") {
              if (event.phase === "discovering") setPlanSubPhase("discovering");
              if (event.phase === "skeleton") setPlanSubPhase("skeleton");
              if (event.phase === "filling") {
                setPlanSubPhase("filling");
                // U3 / TD-7: lock Day tab on Day 1; do not follow fill dayIndex.
                setFocusDayIndex(1);
                if (event.dayIndex == null || event.dayIndex === 1) {
                  setLiveSlots([]);
                  setDayPending(true);
                }
                if (event.dayIndex != null && event.daysTotal != null) {
                  setGenProgress({ current: event.dayIndex, total: event.daysTotal });
                }
              }
              applyNarrative(event);
            } else if (event.type === "slot_preview" && event.kind && event.name) {
              const preview = event as { type: "slot_preview"; dayIndex?: number } & SlotPreviewPayload;
              // Only surface Day 1 previews while tab stays on Day 1.
              if (preview.dayIndex == null || preview.dayIndex === 1) {
                setSlotPreviewText(formatSlotPreviewLine(preview, t));
              }
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
              const skDone = event as { tripId?: string; revision?: number };
              if (typeof skDone.revision === "number") {
                setTripRevision(skDone.revision);
                tripRevisionRef.current = skDone.revision;
              }
              if (typeof skDone.tripId === "string") {
                setTripId(skDone.tripId);
                tripIdRef.current = skDone.tripId;
              }
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
              // U3: stream live slots only for Day 1 while tab stays locked.
              if (event.dayIndex == null || event.dayIndex === 1) {
                setLiveSlots((prev) => [...prev, event.slot!]);
              }
            } else if (event.type === "stop_filled" && event.slot && event.itinerary) {
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              if (event.dayIndex == null || event.dayIndex === 1) {
                setLiveSlots((prev) => [...prev, event.slot!]);
                setDayPending(true);
                setSlotPreviewText(null);
              }
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
              if (event.dayIndex == null || event.dayIndex === 1) {
                setLiveSlots([]);
                setDayPending(false);
                setSlotPreviewText(null);
              }
              if (event.dayIndex != null && event.daysTotal != null) {
                setGenProgress({ current: event.dayIndex, total: event.daysTotal });
              }
              applyNarrative(event);
            } else if (event.type === "done" && event.itinerary) {
              sawDone = true;
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              const doneEv = event as { tripId?: string; revision?: number };
              if (typeof doneEv.revision === "number") {
                setTripRevision(doneEv.revision);
                tripRevisionRef.current = doneEv.revision;
              }
              if (typeof doneEv.tripId === "string") {
                setTripId(doneEv.tripId);
                tripIdRef.current = doneEv.tripId;
              }
              setPagePhase("done");
              setGenProgress(null);
              setPlanSubPhase(criteria.planMode === "skeleton" ? "skeleton" : "idle");
              setLiveSlots([]);
              setDayPending(false);
              setFocusDayIndex(1);
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
          setPlanSubPhase("idle");
          setLiveSlots([]);
          setDayPending(false);
          setSlotPreviewText(null);
          navLinesRef.current = appendAssistantLine(navLinesRef.current, t(friendly));
          setNavStatusLines(navLinesRef.current);
        } else if (!sawDone && !sawError) {
          const key = "play.plan.assistant_fill_timeout";
          setErrorKey(key);
          setPagePhase("done");
          setPlanSubPhase("idle");
          setLiveSlots([]);
          setDayPending(false);
          setSlotPreviewText(null);
          navLinesRef.current = appendAssistantLine(navLinesRef.current, t(key));
          setNavStatusLines(navLinesRef.current);
        }
      } catch (err) {
        const aborted =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        const key = aborted
          ? "play.plan.assistant_fill_timeout"
          : err instanceof AuthApiError
            ? friendlyMakeErrorKey(resolveErrorKey(err.key))
            : "play.plan.assistant_make_failed";
        setErrorKey(key);
        setPagePhase("done");
        setPlanSubPhase("idle");
        setLiveSlots([]);
        setDayPending(false);
        setSlotPreviewText(null);
        navLinesRef.current = appendAssistantLine(navLinesRef.current, t(key));
        setNavStatusLines(navLinesRef.current);
      } finally {
        window.clearTimeout(abortTimer);
        if (abortRef.current === controller) abortRef.current = null;
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

  /** After T3 skeleton: stream fill without remaking skeleton (planMode=fill). */
  const runFillFromSkeleton = useCallback(
    async (criteria: PlanBoundaries) => {
      setLoading(true);
      setPagePhase("planning");
      setPlanSubPhase("filling");
      setFocusDayIndex(1);
      setLiveSlots([]);
      setDayPending(true);
      setErrorKey(null);
      setPlanCompleteLine(null);
      setSlotPreviewText(null);
      setMakeElapsedMs(0);
      const makeStartedAt = Date.now();
      const elapsedTimer = window.setInterval(() => {
        setMakeElapsedMs(Date.now() - makeStartedAt);
      }, 100);
      // Match BFF maxDuration (300s) so UI never sticks on queued day tabs.
      const controller = new AbortController();
      abortRef.current = controller;
      const abortTimer = window.setTimeout(() => controller.abort(), 300_000);

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
            signal: controller.signal,
            body: JSON.stringify({
              ...criteria,
              locale,
              planMode: "fill",
              mode: "fill",
              ...((criteria.tripId ?? tripId) ? { trip_id: criteria.tripId ?? tripId } : {}),
              ...(typeof (criteria.revision ?? tripRevision) === "number"
                ? { revision: criteria.revision ?? tripRevision }
                : {}),
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

            if (event.type === "ledger") {
              const ledgerEv = event as { tripId?: string; revision?: number };
              if (typeof ledgerEv.revision === "number") {
                setTripRevision(ledgerEv.revision);
                tripRevisionRef.current = ledgerEv.revision;
              }
              if (typeof ledgerEv.tripId === "string") {
                setTripId(ledgerEv.tripId);
                tripIdRef.current = ledgerEv.tripId;
              }
            } else if (event.type === "tips" && event.data) {
              setTravelTips(event.data);
              setTravelTipsLoading(false);
              setTravelTipsError(null);
            } else if (event.type === "phase") {
              if (event.phase === "filling") {
                setPlanSubPhase("filling");
                // U3 / TD-7: keep Day 1 selected while later days fill in background.
                setFocusDayIndex(1);
                if (event.dayIndex != null && event.daysTotal != null) {
                  setGenProgress({ current: event.dayIndex, total: event.daysTotal });
                }
              }
              applyNarrative(event);
            } else if (event.type === "slot_preview" && event.kind && event.name) {
              const preview = event as { type: "slot_preview"; dayIndex?: number } & SlotPreviewPayload;
              if (preview.dayIndex == null || preview.dayIndex === 1) {
                setSlotPreviewText(formatSlotPreviewLine(preview, t));
              }
              applyNarrative(event);
            } else if (event.type === "transit" && event.slot && event.itinerary) {
              setItinerary(event.itinerary);
              if (event.dayIndex == null || event.dayIndex === 1) {
                setLiveSlots((prev) => [...prev, event.slot!]);
              }
            } else if (event.type === "stop_filled" && event.slot && event.itinerary) {
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              if (event.dayIndex == null || event.dayIndex === 1) {
                setLiveSlots((prev) => [...prev, event.slot!]);
                setDayPending(true);
                setSlotPreviewText(null);
              }
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
              }
              applyNarrative(event);
            } else if (event.type === "day_done" && event.itinerary) {
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              if (event.dayIndex == null || event.dayIndex === 1) {
                setLiveSlots([]);
                setDayPending(false);
                setSlotPreviewText(null);
              }
              if (event.dayIndex != null && event.daysTotal != null) {
                setGenProgress({ current: event.dayIndex, total: event.daysTotal });
              }
              applyNarrative(event);
            } else if (event.type === "done" && event.itinerary) {
              sawDone = true;
              setItinerary(event.itinerary);
              setFillRouteDays(buildFillRouteDays(event.itinerary, t, { includeTransit: true }));
              const doneEv = event as { tripId?: string; revision?: number };
              if (typeof doneEv.revision === "number") {
                setTripRevision(doneEv.revision);
                tripRevisionRef.current = doneEv.revision;
              }
              if (typeof doneEv.tripId === "string") {
                setTripId(doneEv.tripId);
                tripIdRef.current = doneEv.tripId;
              }
              setPagePhase("done");
              setGenProgress(null);
              setPlanSubPhase("idle");
              setLiveSlots([]);
              setDayPending(false);
              setFocusDayIndex(1);
              setSlotPreviewText(null);
              applyNarrative(event);
            } else if (event.type === "error") {
              sawError = event.key ?? "errors.provider_failed";
              console.error("fill stream error", event.key, "detail" in event ? event.detail : undefined);
            }
          },
        );

        if (sawError && !sawDone) {
          const friendly = friendlyMakeErrorKey(resolveErrorKey(sawError));
          setErrorKey(friendly);
          setPagePhase("done");
          // Keep partial itinerary; unlock later day tabs (do not stay in fill/skeleton lock).
          setPlanSubPhase("idle");
          setLiveSlots([]);
          setDayPending(false);
          setSlotPreviewText(null);
          navLinesRef.current = appendAssistantLine(navLinesRef.current, t(friendly));
          setNavStatusLines(navLinesRef.current);
        } else if (!sawDone && !sawError) {
          // Stream closed without done/error (BFF maxDuration kill, network drop, abort).
          const key = "play.plan.assistant_fill_timeout";
          setErrorKey(key);
          setPagePhase("done");
          setPlanSubPhase("idle");
          setLiveSlots([]);
          setDayPending(false);
          setSlotPreviewText(null);
          navLinesRef.current = appendAssistantLine(navLinesRef.current, t(key));
          setNavStatusLines(navLinesRef.current);
        }
      } catch (err) {
        const aborted =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        const key = aborted
          ? "play.plan.assistant_fill_timeout"
          : err instanceof AuthApiError
            ? friendlyMakeErrorKey(resolveErrorKey(err.key))
            : "play.plan.assistant_make_failed";
        setErrorKey(key);
        setPagePhase("done");
        setPlanSubPhase("idle");
        setLiveSlots([]);
        setDayPending(false);
        setSlotPreviewText(null);
        navLinesRef.current = appendAssistantLine(navLinesRef.current, t(key));
        setNavStatusLines(navLinesRef.current);
      } finally {
        window.clearTimeout(abortTimer);
        if (abortRef.current === controller) abortRef.current = null;
        window.clearInterval(elapsedTimer);
        if (sawDone && !sawError) setMakeElapsedMs(null);
        else setMakeElapsedMs(Date.now() - makeStartedAt);
        setLoading(false);
      }
    },
    [locale, t, tripId, tripRevision],
  );

  async function onTakeoffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setSubmitConfirmOpen(false);

    const errors: TakeoffFieldErrors = {};
    if (!destination.trim()) errors.destination = "play.plan.error.destination_required";
    else if (!destVerified) errors.destination = "play.plan.dest_geocode_failed";
    if (!startDate.trim()) errors.startDate = "play.plan.error.start_date_required";
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 14) errors.days = "play.plan.error.days_range";
    const p = Number(partySize);
    if (!Number.isInteger(p) || p < 1) errors.partySize = "play.plan.error.days_range";
    if (!budget.trim()) errors.budget = "play.plan.error.budget_required";
    if (!tripType.trim()) errors.tripType = "play.plan.error.budget_required";
    if (!pace.trim()) errors.pace = "play.plan.error.budget_required";
    if (!transit.trim()) errors.transit = "play.plan.error.budget_required";
    if (!(startTime.trim() || "09:00")) errors.startTime = "play.plan.error.start_date_required";

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      pendingSubmitConfirmRef.current = false;
      return;
    }
    setFieldErrors({});

    if (!destVerified) return;

    // Auto-validate origin on submit when present (Fig2 UX). ADR-064: origin before confirm.
    const originQ = origin.trim();
    const dest = destination.trim();
    if (originQ && dest) {
      setOriginResolving(true);
      try {
        const res = await authJson<{
          ok?: boolean;
          kind?: string;
          name?: string;
          lat?: number;
          lng?: number;
          provider?: string;
          native_id?: string;
          photos?: string[];
          cards?: Array<{ name: string; lat?: number; lng?: number; provider?: string; native_id?: string }>;
        }>("/api/plan/resolve-origin", {
          method: "POST",
          body: JSON.stringify({ query: originQ, destination: dest, locale }),
        });
        if (res.kind === "hit" && res.name && typeof res.lat === "number" && typeof res.lng === "number") {
          setOrigin(res.name);
          setOriginLat(res.lat);
          setOriginLng(res.lng);
          setOriginStay({
            name: res.name,
            lat: res.lat,
            lng: res.lng,
            ...(res.provider ? { provider: res.provider } : {}),
            ...(res.native_id ? { native_id: res.native_id } : {}),
            ...(Array.isArray(res.photos) && res.photos.length ? { photos: res.photos.slice(0, 1) } : {}),
          });
          setOriginOverlay(null);
        } else if (res.kind === "candidates" && res.cards?.length) {
          pendingSubmitConfirmRef.current = true;
          setSubmitConfirmOpen(false);
          setOriginOverlay({
            kind: "candidates",
            query: originQ,
            destination: dest,
            cards: res.cards,
          });
          return;
        } else if (res.kind === "skip") {
          setOriginOverlay(null);
        } else {
          pendingSubmitConfirmRef.current = true;
          setSubmitConfirmOpen(false);
          setOriginOverlay({ kind: "not_found", query: originQ, destination: dest });
          return;
        }
      } catch {
        pendingSubmitConfirmRef.current = true;
        setSubmitConfirmOpen(false);
        setOriginOverlay({ kind: "not_found", query: originQ, destination: dest });
        return;
      } finally {
        setOriginResolving(false);
      }
    }

    pendingSubmitConfirmRef.current = false;
    setOriginOverlay(null);
    setSubmitConfirmOpen(true);
  }

  function onSubmitConfirmOk() {
    setSubmitConfirmOpen(false);
    pendingSubmitConfirmRef.current = false;

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

    if (pagePhase === "intake" || pagePhase === "progress" || pagePhase === "planning" || pagePhase === "done") {
      setReplanDialogVariant("replan");
      setPendingReplanAction(() => () => resetToBlankTakeoff());
      setReplanDialogOpen(true);
      return;
    }

    beginT3Progress();
  }

  function beginT3Progress() {
    resetPlanningState();
    setPagePhase("progress");
    setNavOpen(true);
    setIntakeStep(null);
    // Seed constraints panel from takeoff (AC1: hotel / departure / other).
    // resetPlanningState cleared intakeAnswers; intakeComplete=true would otherwise
    // show "no hotel" and default 09:00 instead of the user's takeoff values.
    setIntakeAnswers({
      b: origin.trim(),
      c: startTime.trim() || "09:00",
      h: other.trim(),
    });
    setIntakeComplete(true);
    setNeedQuestions([]);
    setNeedIndex(0);
    setNeedAnswers({});
    // Optimistic progress: generating while BFF runs (trip_created is not a user-visible step).
    setT3Phases([{ phase: "skeleton_generating" }]);
    setFrameworkReadyLine(null);
    setFillBeginLine(null);
    setLoading(true);
    setPlanSubPhase("skeleton");
    setErrorKey(null);
    discoverJobRef.current = runT3SkeletonPlan();
  }

  const runT3SkeletonPlan = useCallback(async (opts?: { answers?: AgentNeedAnswers }) => {
    const fields = takeoff;
    // Browser-side ceiling slightly above BFF plan timeout so UI never sticks on「正在生成框架」。
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), 130_000);
    try {
      const expandAnswer = opts?.answers?.expand_radius;
      const res = await authJson<{
        ok?: boolean;
        trip_id?: string;
        revision?: number;
        status?: string;
        phases?: Array<{ phase: string; trip_id?: string; revision?: number }>;
        skeleton?: unknown;
        need_input?: {
          questions: Array<{
            id: string;
            prompt: string;
            options?: Array<{ id: string; label: string }>;
            multi?: boolean;
          }>;
        };
        error?: { key?: string };
      }>("/api/plan/trip", {
        method: "POST",
        signal: controller.signal,
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
          skeleton_only: true,
          ...(origin.trim() ? { originName: origin.trim() } : {}),
          startTime: startTime.trim() || "09:00",
          ...(other.trim() ? { other: other.trim() } : {}),
          ...(tripIdRef.current ? { trip_id: tripIdRef.current } : {}),
          ...(typeof tripRevisionRef.current === "number"
            ? { revision: tripRevisionRef.current }
            : {}),
          ...(expandAnswer === "yes" || expandAnswer === "no"
            ? { answers: { expand_radius: expandAnswer } }
            : {}),
        }),
      });

      if (res.phases?.length) setT3Phases(res.phases);

      if (res.trip_id) {
        setTripId(res.trip_id);
        tripIdRef.current = res.trip_id;
      }
      if (typeof res.revision === "number") {
        setTripRevision(res.revision);
        tripRevisionRef.current = res.revision;
      }

      if (res.status === "needs_input") {
        const qs = (res.need_input?.questions ?? []).filter((q) => q.id === "expand_radius");
        if (qs.length) {
          setNeedQuestions(qs);
          setNeedIndex(0);
          setLoading(false);
          setPlanSubPhase("skeleton");
          return;
        }
      }

      if (!res.ok || res.status === "failed" || !res.skeleton) {
        setT3Phases((prev) =>
          prev.some((p) => p.phase === "failed")
            ? prev
            : [...prev, { phase: "failed" }],
        );
        setErrorKey(resolveErrorKey(res.error?.key ?? "errors.provider_failed"));
        setLoading(false);
        setPlanSubPhase("idle");
        return;
      }

      setNeedQuestions([]);
      const criteria: PlanBoundaries = {
        destination: fields.destination,
        startDate: fields.startDate,
        days: fields.days,
        partySize: fields.partySize,
        budget: fields.budget,
        tripType: fields.tripType?.trim() || t("play.plan.trip_type.couple_romance"),
        pace: fields.pace === "tight" || fields.pace === "relaxed" ? fields.pace : "medium",
        transport: fields.transit === "drive_walk" ? "drive_walk" : "transit_walk",
        locale,
        tripId: res.trip_id,
        revision: res.revision,
      };
      const hydrated = hydrateFromAgentSkeleton(criteria, res.skeleton, t);
      if (!hydrated) {
        setT3Phases((prev) =>
          prev.some((p) => p.phase === "failed") ? prev : [...prev, { phase: "failed" }],
        );
        setErrorKey("play.plan.assistant_fetch_failed");
        setLoading(false);
        setPlanSubPhase("idle");
        return;
      }

      setItinerary(hydrated.itinerary);
      setSkeletonDays(hydrated.skeletonDays);
      setSkeletonDeviations(hydrated.deviations);
      setFocusDayIndex(hydrated.skeletonDays[0]?.dayIndex ?? 1);
      setPlanSubPhase("skeleton");
      setPagePhase("done");
      setFrameworkReadyLine(
        t("play.plan.assistant_framework_ready", {
          destination: fields.destination,
          days: String(fields.days),
          partySize: String(fields.partySize),
          tripType:
            formatTripTypeDisplay(fields.tripType, t) ||
            t("play.plan.trip_type.couple_romance"),
        }),
      );
      setLoading(false);

      // Soft two-step: show skeleton + fill-begin copy, then append fill (do not replace skeleton).
      setFillBeginLine(t("play.plan.assistant_fill_begin"));
      if (res.trip_id) {
        clearFillHoldTimer();
        const fillCriteria: PlanBoundaries = {
          ...criteria,
          tripId: res.trip_id,
          revision: res.revision,
          planMode: "fill",
          ...(origin.trim()
            ? {
                dailyStart: origin.trim(),
                ...(typeof originLat === "number" && typeof originLng === "number"
                  ? { originLat, originLng }
                  : {}),
                ...(originStay ? { originStay } : {}),
              }
            : {}),
          timeFrom: startTime.trim() || "09:00",
        };
        fillHoldTimerRef.current = window.setTimeout(() => {
          fillHoldTimerRef.current = null;
          void runFillFromSkeleton(fillCriteria);
        }, SKELETON_HOLD_BEFORE_FILL_MS);
      }
    } catch (err) {
      const key =
        err instanceof AuthApiError
          ? resolveErrorKey(err.key)
          : "play.errors.provider_failed";
      setT3Phases((prev) =>
        prev.some((p) => p.phase === "failed") ? prev : [...prev, { phase: "failed" }],
      );
      setErrorKey(key);
      setLoading(false);
      setPlanSubPhase("idle");
      if (
        err instanceof AuthApiError &&
        (err.key === "errors.session_expired" || err.key === "errors.csrf")
      ) {
        window.location.assign("/login");
      }
    } finally {
      window.clearTimeout(abortTimer);
    }
  }, [locale, takeoff, t, origin, startTime, other, originLat, originLng, originStay, runFillFromSkeleton, clearFillHoldTimer]);

  runFillFromSkeletonRef.current = runFillFromSkeleton;

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
      const next = nextOpenIntakeStep(step, { ...intakeAnswers, [step]: stored });
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
      setIntakeStep(nextOpenIntakeStep(step, { ...intakeAnswers, [step]: value }));
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
    const slotDetails = {
      name: slot.name,
      summary: slot.summary,
      ...(slot.photoUrl ? { photos: [slot.photoUrl] } : {}),
      ...(slot.provider ? { provider: slot.provider } : {}),
      ...(slot.nativeId
        ? { sources: [{ provider: slot.provider, native_id: slot.nativeId }] }
        : {}),
    };
    if (!slot.provider || !slot.nativeId || !isResolvablePlaceNativeId(slot.provider, slot.nativeId)) {
      setPlaceDetails(slotDetails);
      setPlaceDetailsLoading(false);
      return;
    }
    setPlaceDetailsLoading(true);
    try {
      const data = await authJson<{ ok: boolean; data?: Record<string, unknown> }>(
        `/api/places/${encodeURIComponent(slot.provider)}/${encodeURIComponent(slot.nativeId)}?locale=${locale}` +
          `&name=${encodeURIComponent(slot.name)}` +
          (destination.trim() ? `&city=${encodeURIComponent(destination.trim())}` : "") +
          (typeof originLat === "number" && typeof originLng === "number"
            ? `&lat=${originLat}&lng=${originLng}`
            : ""),
      );
      // ADR-051: do not treat details photos as a second thumb truth source for the list;
      // sheet may show details photos for lightbox when present.
      const merged = {
        ...slotDetails,
        ...(data.data ?? {}),
        photos:
          (Array.isArray((data.data as { photos?: unknown })?.photos)
            ? (data.data as { photos: string[] }).photos
            : undefined) ?? slotDetails.photos,
      };
      setPlaceDetails(merged);
    } catch {
      // Soft degrade: keep slot name/photo; only show error when nothing useful to show.
      setPlaceDetails(slotDetails);
      if (!slot.photoUrl && !slot.summary?.trim()) {
        setPlaceDetailsError("play.plan.place_sheet_error");
      }
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
            startTime={startTime}
            origin={origin}
            other={other}
            destVerifiedLabel={destVerifiedLabel}
            fieldErrors={fieldErrors}
            originOverlay={originOverlay}
            focusOriginToken={focusOriginToken}
            submitEnabled={takeoffSubmitEnabled}
            disabled={loading}
            onDestinationChange={onDestinationChange}
            onDestinationBlur={() => {
              void onDestinationBlur();
            }}
            onStartDateChange={setStartDate}
            onDaysChange={setDays}
            onPartySizeChange={setPartySize}
            onBudgetChange={setBudget}
            onTripTypeChange={setTripType}
            onPaceChange={setPace}
            onTransitChange={setTransit}
            onStartTimeChange={setStartTime}
            onOriginChange={onOriginChange}
            onOriginBlur={(value) => {
              void onOriginBlur(value);
            }}
            onOtherChange={setOther}
            onOriginPick={onOriginPick}
            onOriginRetry={onOriginRetry}
            onOriginSkip={onOriginSkip}
            submitConfirmOpen={submitConfirmOpen}
            onSubmitConfirmCancel={onSubmitConfirmCancel}
            onSubmitConfirmOk={onSubmitConfirmOk}
            onSubmit={(e) => {
              void onTakeoffSubmit(e);
            }}
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

        {showItinerary && (itinerary || loading || pagePhase === "progress") ? (
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
            generating={
              loading && (planSubPhase === "skeleton" || planSubPhase === "filling")
            }
            queueFutureDays={loading && planSubPhase === "filling"}
            skeletonStops={displaySkeletonStops}
            slotPreviewText={slotPreviewText}
            saving={saving}
            onReplan={
              pagePhase === "done" || pagePhase === "planning" || pagePhase === "progress"
                ? requestReplan
                : undefined
            }
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
          intakeComplete={
            intakeComplete ||
            pagePhase === "planning" ||
            pagePhase === "done" ||
            pagePhase === "progress"
          }
          fillingLocked={
            loading ||
            mustSeeLoading ||
            travelTipsLoading ||
            pagePhase === "progress"
          }
          skeletonDays={skeletonDays}
          fillRouteDays={fillRouteDays}
          statusLines={navStatusLines}
          planCompleteLine={planCompleteLine}
          t3Mode={t3Mode}
          t3ProgressSteps={t3Mode ? t3ProgressSteps : undefined}
          frameworkReadyLine={frameworkReadyLine}
          fillBeginLine={fillBeginLine}
          deviations={skeletonDeviations}
          nextHintLine={
            planCompleteLine ? t("play.plan.assistant_next_hint") : null
          }
          onSoftReplan={planCompleteLine ? requestReplan : undefined}
          composerPlaceholder={
            pagePhase === "progress" || loading ? t("play.plan.composer_locked_ph") : undefined
          }
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
          onAgentNeedAnswer={(id, value) => {
            void (async () => {
              const needId = id as AgentNeedId;
              if (needId === "expand_radius") {
                const answer =
                  value === "yes" || value === "no"
                    ? value
                    : /^(yes|y|true|1|expand)/i.test(value.trim())
                      ? "yes"
                      : "no";
                const nextAnswers: AgentNeedAnswers = {
                  ...needAnswers,
                  expand_radius: answer,
                };
                setNeedAnswers(nextAnswers);
                setLoading(true);
                setPlanSubPhase("skeleton");
                setPagePhase("progress");
                clearFillHoldTimer();
                setFrameworkReadyLine(null);
                setFillBeginLine(null);
                setT3Phases((prev) => {
                  const base = prev.length
                    ? prev.filter((p) => p.phase !== "skeleton_ready" && p.phase !== "failed")
                    : [{ phase: "skeleton_generating" }];
                  if (!base.some((p) => p.phase === "skeleton_generating")) {
                    return [...base, { phase: "skeleton_generating" }];
                  }
                  return base;
                });
                discoverJobRef.current = runT3SkeletonPlan({ answers: nextAnswers });
              }
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
