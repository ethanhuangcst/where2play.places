# Vitest must not wipe the app database

**As of:** 2026-09-04  
**Related:** `vitest.config.ts`, `tests/setup.ts`, `tests/helpers/test-database-url.ts`

## Lesson

Vitest (Vite) loads `.env.local`. Config had:

`DATABASE_URL: process.env.DATABASE_URL ?? …/where2play_test`

So local app URL (`…/where2play`) won. `beforeEach` → `user.deleteMany()` erased real accounts. Login then returned 401 (`errors.login_failed`) because the row was gone — not because the password changed.

## Fix

- Resolve Vitest DB via `TEST_DATABASE_URL` or hard default `where2play_test`; **ignore** app `DATABASE_URL`.
- `assertSafeTestDatabaseUrl` refuses destructive reset unless DB name ends with `_test`.

## Ops

After a wipe: re-register (accounts are not recoverable from this path). Keep `SESSION_SECRET` non-empty in `.env.local` (empty overrides shell; see `next-env-css-mvp1.md`).
