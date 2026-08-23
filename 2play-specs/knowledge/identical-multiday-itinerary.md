---
title: Multi-day identical itinerary fix
type: ops-lesson
status: active
as_of: 2026-08-23
tags:
  - where2play
  - places-agent
  - plan
  - ADR-032
  - ADR-037
related_spec: 2play-specs/2play-design.md
related:
  - adr/ADR-032-llm-itinerary-mcp-tool-split.md
  - adr/ADR-037-where2play-plan-l2-quanzil.md
---

# Multi-day identical itinerary fix

## Summary

Taipei (and similar same-city) N-day plans looked identical because where2play called `plan_itinerary` once per day with the same anchors and no exclude list.

**Historical fix (ADR-032 era):** one `discover_places`, then agent `arrange_day` per day with `usedNames` filtered out of candidates.

**Current as-built (ADR-037):** one `discover_places` (L1), then **BFF OPENAI_CN** arrange×N with cross-day `usedNames` / exclude — **not** agent `arrange_day` execution=agent as the default. Prompt may later come from agent Mode H (`execution=host`, Feature **35** / 2play `plan-11`).

## Evidence

- Bug path: `planItineraryDayByDay` used N× 1-day `plan_itinerary`
- Current orchestration: [`src/core/plan-day-by-day.ts`](../../src/core/plan-day-by-day.ts) + [`plan-arrange-llm.ts`](../../src/core/plan-arrange-llm.ts)

## Lesson / guidance

- Prefer discover → per-day schedule with exclude list; never N× full `plan_itinerary` without excluding used POIs
- 2play default L2 executor is **product OPENAI_CN** (ADR-037), not agent tool wait
- Agent still validates multi-day uniqueness when callers use `plan_itinerary` / `arrange_day` directly

## Ops trap (2026-08-21)

If local places-agent is started **without** `NODE_ENV=development` (see `scripts/dev-server.sh`), Next may serve a **stale production** `.next` build that lacks `app/v1/discover_places`. Then `/v1/discover_places` returns **404**, and older BFFs may fall back to N× `plan_itinerary` (identical days).

**Check:** `GET /v1/health` must list `discover_places` (and `arrange_day` for MCP/other callers). If missing, restart with `./scripts/dev-server.sh` or rebuild production `.next`.
