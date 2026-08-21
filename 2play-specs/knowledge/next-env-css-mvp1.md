---
title: Next.js env + CSS gotchas (where2play MVP-1)
type: ops-lesson
status: active
as_of: 2026-08-21
tags:
  - nextjs
  - session
  - css
  - where2play
related_spec: 2play-specs/2play-test-plan.md
related:
  - knowledge/mvp1-quality-gate.md
  - ../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md
---

# Next.js env + CSS gotchas (where2play MVP-1)

## Summary

Empty `SESSION_SECRET=` in `.env.local` overrides shell env under Next.js. A second Google Fonts `@import` after Tailwind in CSS merges to a hard 500. Mitigations: treat blank secret as missing in dev; load fonts via `<link>`.

## Evidence

- Next.js loads `.env.local` and **overrides** shell environment variables for the same key. `SESSION_SECRET=` (empty) therefore wins over `SESSION_SECRET=…` exported by an E2E harness.
- App mitigation: `src/auth/session-token.ts` treats blank as missing and, outside production, falls back to a fixed insecure dev secret. Production still requires a non-empty secret.
- `app/globals.css` starts with `@import "tailwindcss"`. A second `@import` for Google Fonts inside `mockup.css` becomes illegal after PostCSS merge (`@import` must precede other rules) → Next **500** on every page.
- Mitigation: Google Fonts via `<link>` in `app/layout.tsx`; keep CJK `@font-face` in `mockup.css` without a Google `@import`.

## Lesson / guidance

- Never write operator `.env.local` from automation (`protect-eng`). Set E2E secrets in process env only.
- Prefer `<link>` for third-party font CSS when Tailwind (or any earlier `@import`) already owns the cascade head.
- Operators: set a real `SESSION_SECRET` in `.env.local` / Portainer before relying on sessions.

## Links

- [`mvp1-quality-gate.md`](./mvp1-quality-gate.md)
- ADR-033 (where2play Postgres)
