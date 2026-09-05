import { describe, expect, it } from "vitest";
import {
  assertSafeTestDatabaseUrl,
  DEFAULT_TEST_DATABASE_URL,
  resolveVitestDatabaseUrl,
} from "./test-database-url";

describe("test-database-url guard", () => {
  it("should_prefer_TEST_DATABASE_URL_over_app_DATABASE_URL", () => {
    const url = resolveVitestDatabaseUrl({
      DATABASE_URL: "postgresql://where2play:where2play@localhost:5435/where2play",
      TEST_DATABASE_URL: DEFAULT_TEST_DATABASE_URL,
    });
    expect(url).toContain("where2play_test");
  });

  it("should_ignore_app_DATABASE_URL_when_TEST_unset", () => {
    const url = resolveVitestDatabaseUrl({
      DATABASE_URL: "postgresql://where2play:where2play@localhost:5435/where2play",
    });
    expect(url).toBe(DEFAULT_TEST_DATABASE_URL);
  });

  it("should_refuse_reset_on_main_where2play_database", () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://where2play:where2play@localhost:5435/where2play",
      ),
    ).toThrow(/non-test database/i);
  });

  it("should_allow_where2play_test", () => {
    expect(() => assertSafeTestDatabaseUrl(DEFAULT_TEST_DATABASE_URL)).not.toThrow();
  });
});
