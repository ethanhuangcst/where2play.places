---
title: where2play MVP-1 close
type: ops-lesson
status: active
as_of: 2026-08-21
tags:
  - where2play
  - mvp-1
  - auth
  - dod
related_spec: 2play-specs/2play-stories.md
related:
  - knowledge/mvp1-quality-gate.md
  - knowledge/next-env-css-mvp1.md
---

# where2play MVP-1 close

## Summary

MVP-1 delivers onboarding for `where2play.place`: public/app shell, four-locale i18n, register/login/reset/set-password, single-card profile with travel interests. Real Postgres (`where2play` / `where2play_test` on `:5435`), HMAC session cookies, mail outbox / Resend sandbox. No product `OPENAI_*`; plan/chat deferred to MVP-2+.

## Evidence

- Features **1–13** in `2play-stories.md` implemented against mock + `2play-design.md`.
- Quality: `make quality` = typecheck + Vitest coverage on auth/profile/locale/geocode + Playwright `test-e2e-mvp1`.
- UX polish at close: home lead copy; city-level reverse-geocode labels (`toCityLabel`); auth link spacing; reset lead left-aligned.
- User confirmed usable 2026-08-21.

## Lesson / guidance

- Mirror what2eat auth/i18n/BFF patterns; keep where2play a thin client to places-agent for place facts only when MVP-2 starts.
- Coverage include must match the shipped slice — exclude chat/plan until those MVPs land; fill 0% routes with contract tests rather than dropping them.
- Shared Postgres on `:5435` is fine; never share database *names* with what2eat / places_agent (ADR-033).

## Links

- [`2play-test-plan.md`](../2play-test-plan.md) §3 MVP-1
- [`mvp1-quality-gate.md`](./mvp1-quality-gate.md)
- Workspace ADR-033
