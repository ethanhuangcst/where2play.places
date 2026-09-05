import path from "node:path";
import { defineConfig } from "vitest/config";
import {
  DEFAULT_TEST_DATABASE_URL,
  resolveVitestDatabaseUrl,
} from "./tests/helpers/test-database-url";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    pool: "forks",
    env: {
      // Never inherit app DATABASE_URL from .env.local — that wiped real users via deleteMany.
      DATABASE_URL: resolveVitestDatabaseUrl(process.env),
      PLACES_AGENT_BASE_URL_LOCAL:
        process.env.PLACES_AGENT_BASE_URL_LOCAL ?? "http://agent.test",
      PLACES_AGENT_CALLER_KEY_LOCAL:
        process.env.PLACES_AGENT_CALLER_KEY_LOCAL ?? "test-key",
      // Keep a named alias for clarity in logs / overrides.
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
