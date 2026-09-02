# Plan progressive NDJSON (discover → arrange)

**Date:** 2026-08-21 · **Updated:** 2026-08-31  
**Status:** accepted — **as-built** Mode H row-by-row arrange + wait motion. **MVP-10 目标** 见 [`itinerary-design.md §16.2`](../itinerary-design.md)（`skeleton_*` / `stop_filled`，退役 staged sleep）。

## BFF → UI events

| `type` | UI |
| --- | --- |
| `phase` discovering / arranging | `.plan-phase.is-busy`; form `.is-dimmed`; btn `.is-generating` |
| `candidate_place` | Discover: `.slot--candidate`; found count in phase |
| `discover_done` | Counts (fallback summary) |
| `arrange_day_start` | Pool / used summary; Day tabs with queued days |
| `day_highlights` | Highlights skeleton; `.slot--pending` |
| `place` | Append slot; grow Highlights title; pending stays |
| `day_done` / `progress` | Refresh itinerary; focus next day |
| `done` | Final itinerary; clear progressive chrome |
| `error` | i18n error key |

Highlights-before-first-place is BFF staging (`day_highlights` before agent stream). No token-level LLM streaming.

## Wait motion

- Phase pulse (`.plan-phase.is-busy`)
- Green submit breathe (`.btn.is-generating`)
- Pending shimmer (`.slot--pending`)
- `prefers-reduced-motion: reduce` disables the above

## Ops notes

- Arrange is LLM-bound (~45s timeout × retries). BFF falls back to batch `arrangeDay` when stream yields no blocks.
- MCP tools remain batch JSON; progressive is HTTP-only (ADR-032 #5).
- Mock SoT（MVP-10）：`06-plan.html`, `06-plan-skeleton.html`, `06-plan-qa.html`. Legacy arrange mocks 已删除。Live route: `/plan`.
