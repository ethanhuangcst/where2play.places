import { z } from "zod";
import type { PlanBoundaries } from "./itinerary-types";
import { buildArrangeDayBody } from "./plan-agent-body";
import { openaiConfigured as isOpenaiConfigured } from "./chat-assistant";
import { openaiApiBaseUrl } from "./openai-config";
import { arrangeDay } from "../places-agent/client";

export type ScheduleCandidate = {
  name: string;
  category?: string;
  rating?: number;
  location?: { lat?: number; lng?: number };
  photos?: string[];
  hours?: string;
  sources?: unknown;
  [key: string]: unknown;
};

export type ScheduleCandidatePools = {
  places: ScheduleCandidate[];
  restaurants: ScheduleCandidate[];
};

export type ArrangeDayBlock = {
  name: string;
  type: string;
  start_time: string;
  duration_min: number;
  reason: string;
  photos?: string[];
  alternatives?: Array<{ name: string; reason?: string }>;
  legs_to_here?: Array<{ mode?: string; duration_min?: number; recommended?: boolean }>;
};

export type ArrangeDayLlmResult = {
  day_index: number;
  date?: string;
  theme?: string;
  blocks: ArrangeDayBlock[];
  from_origin?: { transport?: string; duration_min?: number };
  to_destination?: { transport?: string; duration_min?: number };
  transit_outcome?: "directions" | "heuristic" | "partial";
};

const blockSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/).transform((s) => {
    // plan-14: normalize H:MM → HH:MM so downstream addMinutes never sees a single-digit hour.
    const m = /^(\d{1,2}):(\d{2})$/.exec(s)!;
    return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
  }),
  duration_min: z.number().int().positive(),
  reason: z.string().min(1),
  photos: z.array(z.string()).optional(),
  alternatives: z
    .array(z.object({ name: z.string(), reason: z.string().optional() }))
    .optional(),
  // plan-16 AC1: preserve legs_to_here from LLM output (do not strip).
  legs_to_here: z
    .array(
      z.object({
        mode: z.string().optional(),
        duration_min: z.number().optional(),
        recommended: z.boolean().optional(),
      }),
    )
    .optional(),
});

const daySchema = z.object({
  day_index: z.number().int().positive().optional(),
  date: z.string().optional(),
  theme: z.string().min(1).optional(),
  blocks: z.array(blockSchema).min(1),
  // plan-16 AC1: preserve from_origin/to_destination/transit_outcome from LLM output.
  from_origin: z
    .object({ transport: z.string().optional(), duration_min: z.number().optional() })
    .optional(),
  to_destination: z
    .object({ transport: z.string().optional(), duration_min: z.number().optional() })
    .optional(),
  transit_outcome: z.enum(["directions", "heuristic", "partial"]).optional(),
});

/** Max slim candidates per pool in the arrange prompt (ADR-038 P0). */
export const ARRANGE_PROMPT_CANDIDATE_LIMIT = 16;

export type ArrangeLlmComplete = (args: {
  system: string;
  user: string;
  signal?: AbortSignal;
  onBlock?: (block: ArrangeDayBlock, index: number) => void;
}) => Promise<string>;

export type ArrangeHostHandoff = {
  system: string;
  user: string;
  outputContract?: string;
};

let arrangeLlmOverride: ArrangeLlmComplete | null = null;
let arrangeHostOverride:
  | ((body: Record<string, unknown>) => Promise<ArrangeHostHandoff>)
  | null = null;

export function setArrangeLlmCompleteForTests(fn: ArrangeLlmComplete | null): void {
  arrangeLlmOverride = fn;
}

export function setArrangeHostForTests(
  fn: ((body: Record<string, unknown>) => Promise<ArrangeHostHandoff>) | null,
): void {
  arrangeHostOverride = fn;
}

function arrangeStreamEnabled(): boolean {
  const raw = process.env.PLAN_ARRANGE_STREAM;
  if (raw === "0" || raw === "false") return false;
  return true;
}

/** Strip fat fields before schedule prompt (ADR-037 / agent P0). */
export function slimCandidateForSchedule(card: ScheduleCandidate): ScheduleCandidate {
  return {
    name: card.name,
    ...(typeof card.category === "string" ? { category: card.category } : {}),
    ...(typeof card.rating === "number" ? { rating: card.rating } : {}),
    ...(card.location && typeof card.location === "object"
      ? {
          location: {
            ...(typeof card.location.lat === "number" ? { lat: card.location.lat } : {}),
            ...(typeof card.location.lng === "number" ? { lng: card.location.lng } : {}),
          },
        }
      : {}),
  };
}

export function slimCandidatePools(pools: ScheduleCandidatePools): ScheduleCandidatePools {
  return {
    places: pools.places.map(slimCandidateForSchedule),
    restaurants: pools.restaurants.map(slimCandidateForSchedule),
  };
}

/** @deprecated Local duplicate prompt — tests only; production uses agent execution=host. */
export function buildArrangeDayMessages(input: {
  locale: string;
  city: string;
  dayIndex: number;
  date?: string;
  criteria: PlanBoundaries;
  candidates: ScheduleCandidatePools;
  excludeNames?: string[];
}): { system: string; user: string } {
  const slim = slimCandidatePools(input.candidates);
  const system = [
    "You are the where2play day itinerary planner.",
    `Respond in locale ${input.locale}.`,
    "Select and order places for ONE day from the candidate lists only.",
    "Return ONLY a JSON object (optional markdown fence) with shape:",
    '{ "day_index": number, "date"?: "YYYY-MM-DD", "theme": string, "blocks": [',
    '  { "name": string, "type": "attraction"|"lunch"|"dinner"|"cafe"|...,',
    '    "start_time": "HH:MM", "duration_min": number, "reason": string }',
    "] }",
    "Rules:",
    "- Every block.name MUST appear in the candidate lists.",
    "- Do not invent place names, photos, or map URLs.",
    "- Give the day one clear theme (e.g. old-town core / terracotta east line / Dayan pagoda area) in `theme`.",
    "- Prefer geographically coherent stops the same day; minimize cross-city zigzags.",
    "- In each reason, you may briefly note walk/taxi travel between stops (estimates OK; no map tools).",
    "- Do NOT schedule two or more stops from the same landmark cluster (e.g. multiple city-wall gates/towers).",
    "- Prefer iconic candidates not listed in excludeNames when available.",
    "- Prefer a balanced day (attractions + meals when candidates exist).",
    "- Do not call places-agent tools or plan_itinerary.",
  ].join("\n");

  const constraints: string[] = [];
  if (input.criteria.partySize != null) {
    constraints.push(`party_size: ${input.criteria.partySize}`);
    if (input.criteria.partySize >= 6) {
      constraints.push("party_size≥6: prefer large-group / big-table pacing");
    }
  }
  if (input.criteria.pace) constraints.push(`pace: ${input.criteria.pace}`);
  if (input.criteria.budget) constraints.push(`budget: ${input.criteria.budget}`);
  if (input.criteria.transport) constraints.push(`transport: ${input.criteria.transport}`);
  if (input.criteria.timeFrom || input.criteria.timeTo) {
    constraints.push(
      `window: ${input.criteria.timeFrom ?? "…"}–${input.criteria.timeTo ?? "…"}`,
    );
  }
  if (input.criteria.interests?.length) {
    constraints.push(`interests: ${input.criteria.interests.join(", ")}`);
  }
  if (input.criteria.constraints) constraints.push(`notes: ${input.criteria.constraints}`);

  const placeLines = slim.places
    .slice(0, ARRANGE_PROMPT_CANDIDATE_LIMIT)
    .map((p) => candidateLine(p));
  const restLines = slim.restaurants
    .slice(0, ARRANGE_PROMPT_CANDIDATE_LIMIT)
    .map((p) => candidateLine(p));

  const user = [
    `City: ${input.city}`,
    `Plan day ${input.dayIndex}${input.date ? ` (${input.date})` : ""}.`,
    constraints.length ? `Constraints: ${constraints.join("; ")}` : "Constraints: none",
    input.excludeNames?.length
      ? `Already used on earlier days (do not reuse): ${input.excludeNames.join(", ")}`
      : "",
    "",
    `## Attraction candidates (${placeLines.length}):`,
    ...placeLines,
    "",
    `## Restaurant candidates (${restLines.length}):`,
    ...restLines,
    "",
    "Return ONLY the JSON object.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { system, user };
}

function candidateLine(p: ScheduleCandidate): string {
  const lat = p.location?.lat;
  const lng = p.location?.lng;
  const loc =
    typeof lat === "number" && typeof lng === "number"
      ? `, lat: ${lat.toFixed(4)}, lng: ${lng.toFixed(4)}`
      : "";
  return `- ${p.name} (${p.category ?? "poi"}, rating: ${p.rating ?? "N/A"}${loc})`;
}

export async function fetchArrangeHostPrompts(input: {
  locale: string;
  criteria: PlanBoundaries;
  providers: string[];
  dayIndex: number;
  date: string;
  candidates: ScheduleCandidatePools;
  excludeNames?: string[];
}): Promise<ArrangeHostHandoff> {
  const body = {
    ...buildArrangeDayBody(input.criteria, {
      locale: input.locale,
      providers: input.providers,
      dayIndex: input.dayIndex,
      date: input.date,
      candidates: input.candidates,
      excludeNames: input.excludeNames,
    }),
    execution: "host",
  };

  if (arrangeHostOverride) {
    return arrangeHostOverride(body);
  }

  const envelope = await arrangeDay(body);
  if (!envelope.ok || !envelope.data) {
    const key = envelope.outcome?.key ?? "errors.provider_failed";
    throw Object.assign(new Error(key), { outcomeKey: key });
  }

  const data = envelope.data as {
    execution?: string;
    system_prompt?: string;
    user_prompt?: string;
    output_contract?: string;
  };

  if (data.execution !== "host" || !data.system_prompt || !data.user_prompt) {
    throw Object.assign(new Error("invalid_host_handoff"), {
      outcomeKey: "errors.provider_failed",
    });
  }

  return {
    system: data.system_prompt,
    user: data.user_prompt,
    outputContract: data.output_contract,
  };
}

export function parseArrangeDayModelText(
  raw: string,
  opts: { dayIndex: number; candidateNames: Set<string>; date?: string },
): { ok: true; value: ArrangeDayLlmResult } | { ok: false; error: string; retryable: boolean } {
  const jsonStr = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: "invalid_json", retryable: true };
  }

  let dayRaw = parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { days?: unknown }).days)) {
    dayRaw = (parsed as { days: unknown[] }).days[0];
  }

  const schema = daySchema.safeParse(dayRaw);
  if (!schema.success) {
    return {
      ok: false,
      error: schema.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      retryable: true,
    };
  }

  const unknown = schema.data.blocks.filter((b) => !opts.candidateNames.has(b.name));
  if (unknown.length) {
    return {
      ok: false,
      error: `unknown_names: ${unknown.map((b) => b.name).join(", ")}`,
      retryable: true,
    };
  }

  return {
    ok: true,
    value: {
      day_index: opts.dayIndex,
      date: opts.date ?? schema.data.date,
      ...(schema.data.theme ? { theme: schema.data.theme } : {}),
      blocks: schema.data.blocks,
      // plan-16 AC1: preserve transit fields from LLM output.
      ...(schema.data.from_origin ? { from_origin: schema.data.from_origin } : {}),
      ...(schema.data.to_destination ? { to_destination: schema.data.to_destination } : {}),
      ...(schema.data.transit_outcome ? { transit_outcome: schema.data.transit_outcome } : {}),
    },
  };
}

function parseSingleBlockObject(
  raw: string,
  candidateNames: Set<string>,
): ArrangeDayBlock | null {
  try {
    const obj = JSON.parse(raw) as unknown;
    const schema = blockSchema.safeParse(obj);
    if (!schema.success) return null;
    if (!candidateNames.has(schema.data.name)) return null;
    return schema.data;
  } catch {
    return null;
  }
}

/** Incrementally extract complete block objects from partial LLM JSON. */
export function extractIncrementalBlocks(
  buffer: string,
  candidateNames: Set<string>,
): { blocks: ArrangeDayBlock[]; consumed: number } {
  const blocksStart = buffer.search(/"blocks"\s*:\s*\[/);
  if (blocksStart < 0) return { blocks: [], consumed: 0 };

  const arrOpen = buffer.indexOf("[", blocksStart);
  if (arrOpen < 0) return { blocks: [], consumed: 0 };

  const found: ArrangeDayBlock[] = [];
  let i = arrOpen + 1;
  let depth = 0;
  let objStart = -1;

  while (i < buffer.length) {
    const ch = buffer[i]!;
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        const slice = buffer.slice(objStart, i + 1);
        const block = parseSingleBlockObject(slice, candidateNames);
        if (block) found.push(block);
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
    i += 1;
  }

  return { blocks: found, consumed: i };
}

/** Join photos from original (fat) candidates by name after LLM. */
export function attachPhotosFromCandidates(
  day: ArrangeDayLlmResult,
  pools: ScheduleCandidatePools,
): ArrangeDayLlmResult {
  const all = [...pools.places, ...pools.restaurants];
  return {
    ...day,
    blocks: day.blocks.map((block) => {
      const card = all.find((c) => c.name === block.name);
      const photos = card?.photos;
      if (Array.isArray(photos) && photos.length > 0) {
        return { ...block, photos: photos.filter((p): p is string => typeof p === "string") };
      }
      return block;
    }),
  };
}

export async function completeArrangeDay(input: {
  locale: string;
  city: string;
  dayIndex: number;
  date: string;
  criteria: PlanBoundaries;
  providers: string[];
  candidates: ScheduleCandidatePools;
  excludeNames?: string[];
  signal?: AbortSignal;
  onBlock?: (block: ArrangeDayBlock, index: number) => void;
}): Promise<ArrangeDayLlmResult> {
  const events: ArrangeDayLlmResult[] = [];
  for await (const ev of streamArrangeDay(input)) {
    if (ev.type === "done") events.push(ev.value);
  }
  const result = events[0];
  if (!result) {
    throw Object.assign(new Error("arrange_failed"), {
      outcomeKey: "errors.provider_failed",
    });
  }
  return result;
}

function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** plan-14: first block must start at timeFrom ± 5min (covers both the
 * "LLM defaults to 10:00 ignoring a 9:30 input" drift and early starts). */
function firstBlockStartViolation(
  blocks: Array<{ start_time: string }>,
  timeFrom?: string,
): string | null {
  if (!timeFrom) return null;
  const from = hhmmToMinutes(timeFrom);
  const first = blocks[0] ? hhmmToMinutes(blocks[0].start_time) : null;
  if (from == null || first == null) return null;
  return Math.abs(first - from) > 5
    ? `first_block_off_time_from: first ${blocks[0]!.start_time} != timeFrom ${timeFrom} (±5min tolerance)`
    : null;
}

/** plan-14: hard start rule appended to the user prompt when timeFrom is set. */
function startTimeHardRule(timeFrom?: string): string {
  if (!timeFrom) return "";
  return `\nHARD RULE: the first block MUST start at ${timeFrom} exactly (up to 5 minutes earlier or later is tolerated).`;
}

/**
 * plan-16 AC5: station timing consistency — block[i].start_time must account for
 * previous block end + recommended leg duration (tolerance 5min).
 */
function stationTimingViolation(
  blocks: Array<{
    start_time: string;
    duration_min: number;
    legs_to_here?: Array<{ duration_min?: number; recommended?: boolean }>;
  }>,
  toleranceMin = 5,
): string | null {
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]!;
    const curr = blocks[i]!;
    const prevEnd = hhmmToMinutes(prev.start_time);
    const currStart = hhmmToMinutes(curr.start_time);
    if (prevEnd == null || currStart == null) continue;
    const prevEndTotal = prevEnd + prev.duration_min;
    const legs = curr.legs_to_here ?? [];
    const recommended = legs.find((l) => l.recommended) ?? legs[0];
    const transitMin = recommended?.duration_min;
    if (transitMin == null) continue;
    const expectedStart = prevEndTotal + transitMin;
    if (currStart < expectedStart - toleranceMin) {
      const expH = Math.floor((expectedStart - toleranceMin) / 60) % 24;
      const expM = (expectedStart - toleranceMin) % 60;
      const expStr = `${String(expH).padStart(2, "0")}:${String(expM).padStart(2, "0")}`;
      return `station_timing: block[${i}] starts ${curr.start_time} but prev ends +${transitMin}min transit = expected ≥ ${expStr} (tolerance ${toleranceMin}min)`;
    }
  }
  return null;
}

/**
 * plan-16 AC6: same-day restaurant dedup — no two meal blocks (lunch/dinner)
 * with the same name.
 */
function sameDayRestaurantDedupViolation(
  blocks: Array<{ name: string; type: string }>,
): string | null {
  const mealNames = new Map<string, string>();
  for (const block of blocks) {
    const t = (block.type ?? "").toLowerCase();
    if (t === "lunch" || t === "dinner") {
      const prev = mealNames.get(block.name);
      if (prev) {
        return `same_day_restaurant_dedup: "${block.name}" used for both ${prev} and ${block.type}`;
      }
      mealNames.set(block.name, block.type);
    }
  }
  return null;
}

export async function* streamArrangeDay(input: {
  locale: string;
  city: string;
  dayIndex: number;
  date: string;
  criteria: PlanBoundaries;
  providers: string[];
  candidates: ScheduleCandidatePools;
  excludeNames?: string[];
  signal?: AbortSignal;
}): AsyncGenerator<
  | { type: "block"; block: ArrangeDayBlock; index: number }
  | { type: "done"; value: ArrangeDayLlmResult }
> {
  const candidateNames = new Set(
    [...input.candidates.places, ...input.candidates.restaurants]
      .map((c) => c.name)
      .filter(Boolean),
  );

  const host = await fetchArrangeHostPrompts({
    locale: input.locale,
    criteria: input.criteria,
    providers: input.providers,
    dayIndex: input.dayIndex,
    date: input.date,
    candidates: input.candidates,
    excludeNames: input.excludeNames,
  });
  const userPrompt = host.user + startTimeHardRule(input.criteria.timeFrom);

  let lastError = "arrange_failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const system =
      attempt === 0
        ? host.system
        : `${host.system}\nPrevious output failed validation: ${lastError}. Fix and return valid JSON only.`;

    let raw = "";
    if (arrangeLlmOverride) {
      raw = await arrangeLlmOverride({ system, user: userPrompt, signal: input.signal });
    } else if (arrangeStreamEnabled()) {
      for await (const ev of streamArrangeLlmBlocks({
        system,
        user: userPrompt,
        signal: input.signal,
        candidateNames,
      })) {
        if (ev.type === "block") {
          yield { type: "block", block: ev.block, index: ev.index };
        } else {
          raw = ev.raw;
        }
      }
    } else {
      raw = await callArrangeLlmBatch({ system, user: userPrompt, signal: input.signal });
    }

    const parsed = parseArrangeDayModelText(raw, {
      dayIndex: input.dayIndex,
      candidateNames,
      date: input.date,
    });
    if (parsed.ok) {
      const violation =
        firstBlockStartViolation(parsed.value.blocks, input.criteria.timeFrom) ??
        stationTimingViolation(parsed.value.blocks) ??
        sameDayRestaurantDedupViolation(parsed.value.blocks);
      if (violation) {
        lastError = violation;
        continue;
      }
      const value = attachPhotosFromCandidates(parsed.value, input.candidates);
      yield { type: "done", value };
      return;
    }
    lastError = parsed.error;
    if (!parsed.retryable) break;
  }

  throw Object.assign(new Error(lastError), {
    outcomeKey: "errors.provider_failed",
  });
}

async function callArrangeLlm(args: {
  system: string;
  user: string;
  signal?: AbortSignal;
  onBlock?: (block: ArrangeDayBlock, index: number) => void;
  candidateNames?: Set<string>;
}): Promise<string> {
  if (arrangeLlmOverride) return arrangeLlmOverride(args);

  if (!isOpenaiConfigured()) {
    throw Object.assign(new Error("openai_not_configured"), {
      outcomeKey: "errors.openai_not_configured",
    });
  }

  if (arrangeStreamEnabled() && args.onBlock && args.candidateNames) {
    let raw = "";
    for await (const ev of streamArrangeLlmBlocks({
      system: args.system,
      user: args.user,
      signal: args.signal,
      candidateNames: args.candidateNames,
    })) {
      if (ev.type === "block") args.onBlock(ev.block, ev.index);
      else raw = ev.raw;
    }
    return raw;
  }

  return callArrangeLlmBatch(args);
}

async function callArrangeLlmBatch(args: {
  system: string;
  user: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const base = openaiApiBaseUrl();
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_completion_tokens: 1280,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      stream: false,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    throw Object.assign(new Error("arrange_llm_failed"), {
      outcomeKey: "errors.provider_failed",
    });
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function* streamArrangeLlmBlocks(args: {
  system: string;
  user: string;
  signal?: AbortSignal;
  candidateNames: Set<string>;
}): AsyncGenerator<
  | { type: "block"; block: ArrangeDayBlock; index: number }
  | { type: "complete"; raw: string }
> {
  if (!isOpenaiConfigured()) {
    throw Object.assign(new Error("openai_not_configured"), {
      outcomeKey: "errors.openai_not_configured",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const base = openaiApiBaseUrl();
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_completion_tokens: 1280,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      stream: true,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    throw Object.assign(new Error("arrange_llm_failed"), {
      outcomeKey: "errors.provider_failed",
    });
  }

  if (!res.body) {
    throw Object.assign(new Error("arrange_llm_empty_stream"), {
      outcomeKey: "errors.provider_failed",
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let fullText = "";
  const emitted = new Set<number>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          const { blocks } = extractIncrementalBlocks(fullText, args.candidateNames);
          for (let idx = 0; idx < blocks.length; idx++) {
            if (!emitted.has(idx)) {
              emitted.add(idx);
              yield { type: "block", block: blocks[idx]!, index: idx };
            }
          }
        }
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }

  yield { type: "complete", raw: fullText };
}

async function callArrangeLlmStreaming(args: {
  system: string;
  user: string;
  signal?: AbortSignal;
  onBlock?: (block: ArrangeDayBlock, index: number) => void;
  candidateNames: Set<string>;
}): Promise<string> {
  let raw = "";
  for await (const ev of streamArrangeLlmBlocks({
    system: args.system,
    user: args.user,
    signal: args.signal,
    candidateNames: args.candidateNames,
  })) {
    if (ev.type === "block") args.onBlock?.(ev.block, ev.index);
    else raw = ev.raw;
  }
  return raw;
}

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

export { isOpenaiConfigured as openaiConfigured };
