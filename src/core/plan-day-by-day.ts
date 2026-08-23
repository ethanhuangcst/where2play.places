import type { ItineraryDto, ItinerarySlot, PlanBoundaries, CandidatePlacePreview } from "./itinerary-types";
import {
  buildDiscoverPlacesBody,
  planDayDates,
} from "./plan-agent-body";
import {
  expandArrangeDayToSlots,
  mapTimedPlanToItineraryDto,
  previewForArrangeBlock,
  type AgentTimedPlan,
  type SlotPreviewPayload,
} from "./itinerary-map";
import {
  discoverPlaces,
  streamV1Ndjson,
  type AgentEnvelope,
  type DiscoverPlacesData,
} from "../places-agent/client";
import {
  streamArrangeDay,
  type ArrangeDayLlmResult,
  type ScheduleCandidatePools,
} from "./plan-arrange-llm";
import { enrichArrangedDay } from "./plan-enrich-transit";

export type PlanProgressEvent =
  | { type: "phase"; phase: "discovering" | "arranging"; dayIndex?: number; daysTotal?: number }
  | { type: "candidate_place"; place: CandidatePlacePreview }
  | { type: "discover_done"; placeCount: number; restaurantCount: number }
  | {
      type: "arrange_day_start";
      dayIndex: number;
      daysTotal: number;
      poolTotal: number;
      usedCount: number;
    }
  | {
      type: "day_highlights";
      dayIndex: number;
      title: string;
      theme?: string;
    }
  | ({ type: "slot_preview"; dayIndex: number } & SlotPreviewPayload)
  | { type: "slot"; dayIndex: number; slot: ItinerarySlot }
  /** @deprecated alias of slot for older UI */
  | { type: "place"; dayIndex: number; slot: ItinerarySlot }
  | {
      type: "day_done";
      dayIndex: number;
      daysTotal: number;
      itinerary: ItineraryDto;
    }
  /** @deprecated alias of day_done for older UI; prefer day_done */
  | {
      type: "progress";
      dayIndex: number;
      daysTotal: number;
      itinerary: ItineraryDto;
    }
  | { type: "done"; itinerary: ItineraryDto }
  | { type: "error"; key: string };

type AgentDay = NonNullable<AgentTimedPlan["days"]>[number];

type NamedCandidate = { name?: unknown } & Record<string, unknown>;

export type CandidatePools = {
  places: NamedCandidate[];
  restaurants: NamedCandidate[];
};

const ARRANGE_TIMEOUT_MS = 110_000;

function slotStageDelayMs(): number {
  const raw = process.env.PLAN_SLOT_STAGE_MS;
  if (raw === undefined || raw === "") return 380;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 380;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Drop places already used on earlier days (by exact name). */
export function filterUnusedCandidates(
  pools: CandidatePools,
  usedNames: Set<string>,
): CandidatePools {
  return {
    places: pools.places.filter(
      (p) => typeof p.name === "string" && p.name.length > 0 && !usedNames.has(p.name),
    ),
    restaurants: pools.restaurants.filter(
      (p) => typeof p.name === "string" && p.name.length > 0 && !usedNames.has(p.name),
    ),
  };
}

export function collectUsedNamesFromDay(day: AgentDay): string[] {
  const names: string[] = [];
  const blocks = Array.isArray(day.blocks) ? day.blocks : [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const rec = block as Record<string, unknown>;
    if (typeof rec.name === "string" && rec.name.length > 0) names.push(rec.name);
    const alts = rec.alternatives;
    if (Array.isArray(alts)) {
      for (const alt of alts) {
        if (alt && typeof alt === "object" && typeof (alt as { name?: unknown }).name === "string") {
          names.push((alt as { name: string }).name);
        }
      }
    }
  }
  return names;
}

function asCandidatePools(raw: unknown): CandidatePools | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as { places?: unknown; restaurants?: unknown };
  const places = Array.isArray(c.places) ? (c.places as NamedCandidate[]) : [];
  const restaurants = Array.isArray(c.restaurants) ? (c.restaurants as NamedCandidate[]) : [];
  if (places.length === 0 && restaurants.length === 0) return null;
  return { places, restaurants };
}

function cardPreview(
  card: NamedCandidate,
  kind: "place" | "restaurant",
): CandidatePlacePreview | null {
  if (typeof card.name !== "string" || !card.name) return null;
  const photos = card.photos;
  const photoUrl =
    Array.isArray(photos) && typeof photos[0] === "string" && photos[0].startsWith("http")
      ? photos[0]
      : undefined;
  return {
    name: card.name,
    placeKind: kind === "restaurant" ? "Food" : "Attraction",
    ...(photoUrl ? { photoUrl } : {}),
  };
}

function emitDayComplete(
  dayIndex: number,
  daysTotal: number,
  itinerary: ItineraryDto,
): PlanProgressEvent[] {
  return [
    { type: "day_done", dayIndex, daysTotal, itinerary },
    { type: "progress", dayIndex, daysTotal, itinerary },
  ];
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

/**
 * ADR-032 progressive: discover (candidate_place*) → arrange per day (place*) → done.
 * Prefers agent NDJSON; synthesizes fine-grained events from batch when needed.
 */
export async function* planItineraryDayByDay(
  criteria: PlanBoundaries,
  opts: { locale: string; providers: string[]; now?: Date },
): AsyncGenerator<PlanProgressEvent> {
  const baseNow = opts.now ?? new Date();
  const daysTotal = Math.max(1, criteria.days);

  yield { type: "phase", phase: "discovering", daysTotal };

  const discoverBody = buildDiscoverPlacesBody(criteria, {
    locale: opts.locale,
    providers: opts.providers,
    now: baseNow,
  });

  let pools: CandidatePools | null = null;
  let placeCount = 0;
  let restaurantCount = 0;
  let sawDiscoverStream = false;
  let discoverStreamFailed = false;

  for await (const ev of streamV1Ndjson("discover_places", discoverBody)) {
    if (ev.type === "error") {
      discoverStreamFailed = true;
      break;
    }
    if (ev.type === "candidate") {
      sawDiscoverStream = true;
      const kind = ev.kind === "restaurant" ? "restaurant" : "place";
      const card = (ev.card ?? {}) as NamedCandidate;
      const preview = cardPreview(card, kind);
      if (preview) {
        if (kind === "restaurant") restaurantCount += 1;
        else placeCount += 1;
        if (!pools) pools = { places: [], restaurants: [] };
        if (kind === "restaurant") pools.restaurants.push(card);
        else pools.places.push(card);
        yield { type: "candidate_place", place: preview };
      }
      continue;
    }
    if (ev.type === "discover_done") {
      sawDiscoverStream = true;
      const counts = ev.counts as { places?: number; restaurants?: number } | undefined;
      if (counts) {
        placeCount = counts.places ?? placeCount;
        restaurantCount = counts.restaurants ?? restaurantCount;
      }
      continue;
    }
    if (ev.type === "batch") {
      sawDiscoverStream = true;
      const envelope = ev.envelope as AgentEnvelope<DiscoverPlacesData>;
      pools = envelope.ok ? asCandidatePools(envelope.data?.candidates) : null;
      if (pools) {
        for (const p of pools.places) {
          const preview = cardPreview(p, "place");
          if (preview) {
            placeCount += 1;
            yield { type: "candidate_place", place: preview };
          }
        }
        for (const r of pools.restaurants) {
          const preview = cardPreview(r, "restaurant");
          if (preview) {
            restaurantCount += 1;
            yield { type: "candidate_place", place: preview };
          }
        }
      }
    }
  }

  if (discoverStreamFailed || !sawDiscoverStream || !pools) {
    const discovered = await discoverPlaces(discoverBody);
    pools = discovered.ok ? asCandidatePools(discovered.data?.candidates) : null;
    placeCount = 0;
    restaurantCount = 0;
    if (pools) {
      for (const p of pools.places) {
        const preview = cardPreview(p, "place");
        if (preview) {
          placeCount += 1;
          yield { type: "candidate_place", place: preview };
        }
      }
      for (const r of pools.restaurants) {
        const preview = cardPreview(r, "restaurant");
        if (preview) {
          restaurantCount += 1;
          yield { type: "candidate_place", place: preview };
        }
      }
    }
  }

  if (!pools) {
    yield { type: "error", key: "errors.provider_failed" };
    return;
  }

  yield {
    type: "discover_done",
    placeCount,
    restaurantCount,
  };

  const dates = planDayDates(daysTotal, criteria.startDate);
  const usedNames = new Set<string>();
  const agentDays: AgentDay[] = [];

  for (let i = 0; i < daysTotal; i++) {
    const dayIndex = i + 1;
    const remaining = filterUnusedCandidates(pools, usedNames);
    if (remaining.places.length === 0 && remaining.restaurants.length === 0) {
      if (agentDays.length === 0) {
        yield { type: "error", key: "errors.provider_failed" };
        return;
      }
      break;
    }

    yield { type: "phase", phase: "arranging", dayIndex, daysTotal };

    const poolTotal = remaining.places.length + remaining.restaurants.length;
    yield {
      type: "arrange_day_start",
      dayIndex,
      daysTotal,
      poolTotal,
      usedCount: usedNames.size,
    };

    let day: AgentDay | null = null;
    let earlyPreviewEmitted = false;
    try {
      const arrangeAbort = AbortSignal.timeout(ARRANGE_TIMEOUT_MS);
      let arranged: ArrangeDayLlmResult | null = null;

      for await (const ev of streamArrangeDay({
        locale: opts.locale,
        city: criteria.destination,
        dayIndex,
        date: dates[i]!,
        criteria,
        providers: opts.providers,
        candidates: remaining as ScheduleCandidatePools,
        excludeNames: [...usedNames],
        signal: arrangeAbort,
      })) {
        if (ev.type === "block" && ev.index === 0 && !earlyPreviewEmitted) {
          earlyPreviewEmitted = true;
          yield {
            type: "slot_preview",
            dayIndex,
            ...previewForArrangeBlock(ev.block),
          };
        }
        if (ev.type === "done") arranged = ev.value;
      }

      if (!arranged) {
        throw Object.assign(new Error("arrange_failed"), {
          outcomeKey: "errors.provider_failed",
        });
      }

      const enriched = await enrichArrangedDay({
        arranged,
        criteria,
        providers: opts.providers,
        locale: opts.locale,
        candidates: pools as ScheduleCandidatePools,
      });

      const theme = enriched.theme?.trim();
      yield {
        type: "day_highlights",
        dayIndex,
        title: theme && theme.length > 0 ? theme : "…",
        ...(theme ? { theme } : {}),
      };
      day = {
        day_index: enriched.day_index,
        date: enriched.date,
        blocks: enriched.blocks,
        from_origin: enriched.from_origin,
        to_destination: enriched.to_destination,
      };
      const expanded = expandArrangeDayToSlots(
        enriched.blocks,
        {
          from_origin: enriched.from_origin,
          to_destination: enriched.to_destination,
        },
        { transport: criteria.transport, transit_outcome: enriched.transit_outcome },
      );
      const stageMs = slotStageDelayMs();
      let slotIndex = 0;
      for (const item of expanded) {
        if (slotIndex === 0 && earlyPreviewEmitted) {
          await sleep(0);
          yield { type: "slot", dayIndex, slot: item.slot };
          yield { type: "place", dayIndex, slot: item.slot };
          slotIndex += 1;
          continue;
        }
        yield { type: "slot_preview", dayIndex, ...item.preview };
        await sleep(stageMs);
        yield { type: "slot", dayIndex, slot: item.slot };
        yield { type: "place", dayIndex, slot: item.slot };
        slotIndex += 1;
      }
    } catch (err) {
      const key = isAbortError(err)
        ? "errors.arrange_timeout"
        : err && typeof err === "object" && "outcomeKey" in err
          ? String((err as { outcomeKey: string }).outcomeKey)
          : "errors.provider_failed";
      if (agentDays.length === 0) {
        yield { type: "error", key };
        return;
      }
      break;
    }

    if (!day?.blocks?.length) {
      if (agentDays.length === 0) {
        yield { type: "error", key: "errors.provider_failed" };
        return;
      }
      break;
    }

    for (const name of collectUsedNamesFromDay(day)) usedNames.add(name);
    agentDays.push(day);

    const itinerary = mapTimedPlanToItineraryDto(
      { detail: "timed", days: agentDays },
      criteria,
      baseNow,
    );
    if (!itinerary.days.some((d) => d.slots.length > 0)) {
      yield { type: "error", key: "errors.provider_failed" };
      return;
    }

    for (const e of emitDayComplete(dayIndex, daysTotal, itinerary)) yield e;
  }

  if (!agentDays.length) {
    yield { type: "error", key: "errors.provider_failed" };
    return;
  }

  yield {
    type: "done",
    itinerary: mapTimedPlanToItineraryDto({ detail: "timed", days: agentDays }, criteria, baseNow),
  };
}
