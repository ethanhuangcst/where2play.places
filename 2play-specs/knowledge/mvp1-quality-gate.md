---
title: MVP-1 quality gate
type: ops-lesson
status: active
as_of: 2026-08-21
tags:
  - testing
  - coverage
  - e2e
related_spec: 2play-specs/2play-test-plan.md
related:
  - knowledge/next-env-css-mvp1.md
---

# MVP-1 quality gate

## Summary

MVP-1 closes with `make quality` = typecheck + Vitest coverage thresholds on auth/profile/locale/geocode critical paths + Playwright `test-e2e-mvp1`. Coverage excludes MVP-3 chat modules until that slice.

## Evidence

- Thresholds (aligned with what2eat): statements/lines/functions ≥ 80%, branches ≥ 75% on the Vitest `coverage.include` set.
- `scripts/with_server.py` reuses an already-listening app URL instead of failing on `EADDRINUSE` and does not kill a process it did not start.
- Critical API contracts covered: register, login, logout, session, reset/set password, locale, profile personal, reverse geocode (city label).

## Lesson / guidance

- Prefer adding route contract tests over shrinking the coverage include list when a route shows 0%.
- Keep chat / plan BFF out of the MVP-1 coverage include until those features ship.
- Do not write `.env.local` in automation; E2E sets `SESSION_SECRET` in the process env (see also `next-env-css-mvp1.md` for empty-key override).

## Links

- [`2play-test-plan.md`](../2play-test-plan.md) §3 MVP-1
- Makefile targets: `test-coverage`, `test-e2e-mvp1`, `quality`
