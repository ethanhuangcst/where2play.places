/** Default Vitest DB — never the local app DB (`where2play`). */
export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://where2play:where2play@localhost:5435/where2play_test";

/**
 * Resolve which Postgres URL Vitest may use.
 * Prefer `TEST_DATABASE_URL`; ignore app `DATABASE_URL` so `.env.local` cannot point
 * wipe helpers at the real `where2play` database.
 */
export function resolveVitestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;
  return DEFAULT_TEST_DATABASE_URL;
}

/** Guard: resetDb / destructive helpers must only run against `*_test` DBs. */
export function assertSafeTestDatabaseUrl(url: string): void {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error(`Invalid TEST database URL: ${url}`);
  }
  if (!pathname.endsWith("_test")) {
    throw new Error(
      `Refusing destructive Vitest DB reset on non-test database "${pathname}". ` +
        `Use where2play_test (or set TEST_DATABASE_URL to a *_test database).`,
    );
  }
}
