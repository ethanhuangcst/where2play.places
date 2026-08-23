import { defineConfig } from "vitest/config";
import path from "node:path";

const testDb =
  process.env.TEST_DATABASE_URL ??
  "postgresql://where2play:where2play@localhost:5435/where2play_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDb,
      TEST_DATABASE_URL: testDb,
      SESSION_SECRET: "test-session-secret-32chars-minimum",
      FEATURE_EMAIL: "false",
      PUBLIC_BASE_URL: "http://localhost:3030",
      APP_URL: "http://localhost:3030",
      PLACES_AGENT_BASE_URL: "http://agent.test",
      PLACES_AGENT_CALLER_KEY: "pa_test_contract_key",
      W2P_DEFAULT_PROVIDERS: '["GOOGLE_MAPS"]',
      PLAN_SLOT_STAGE_MS: "0",
    },
    coverage: {
      provider: "v8",
      include: [
        "src/auth/**/*.ts",
        "src/core/crypto.ts",
        "src/core/locales.ts",
        "src/core/interests.ts",
        "src/core/city-label.ts",
        "src/core/itinerary-map.ts",
        "src/core/plan-validate.ts",
        "src/core/plan-agent-body.ts",
        "app/api/auth/**/*.ts",
        "app/api/profile/**/*.ts",
        "app/api/locale/**/*.ts",
        "app/api/geocode/**/*.ts",
        "app/api/plan/**/*.ts",
      ],
      exclude: ["**/*.test.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
