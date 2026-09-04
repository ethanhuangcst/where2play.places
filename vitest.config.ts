import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    pool: "forks",
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://where2play:where2play@localhost:5435/where2play_test",
      PLACES_AGENT_BASE_URL_LOCAL:
        process.env.PLACES_AGENT_BASE_URL_LOCAL ?? "http://agent.test",
      PLACES_AGENT_CALLER_KEY_LOCAL:
        process.env.PLACES_AGENT_CALLER_KEY_LOCAL ?? "test-key",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
