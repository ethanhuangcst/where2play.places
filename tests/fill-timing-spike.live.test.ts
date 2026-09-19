/**
 * Live fill timing spike — run with:
 *   FILL_SPIKE_LIVE=1 npm test -- tests/fill-timing-spike.live.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planItinerarySkeletonFill } from "../src/core/plan-skeleton-fill";

const SPIKE_OUT = path.join(process.cwd(), "tests", ".fill-timing-spike.json");

const LIVE = process.env.FILL_SPIKE_LIVE === "1";

type SpikeResult = {
  destination: string;
  totalMs: number;
  stopCount: number;
  hopLogs: string[];
};

async function runFillSpike(destination: string, dailyStart: string): Promise<SpikeResult> {
  const hopLogs: string[] = [];
  const origInfo = console.info;
  console.info = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    if (line.includes("plan_fill_stop")) hopLogs.push(line);
    origInfo(...args);
  };

  const started = Date.now();
  let stopCount = 0;
  try {
    for await (const ev of planItinerarySkeletonFill(
      {
        destination,
        days: 3,
        startDate: "2026-10-10",
        dailyStart,
        timeFrom: "09:00",
        pace: "Balanced",
        budget: "$ Economy",
      },
      { locale: "CN", providers: ["GOOGLE_MAPS"] },
    )) {
      if (ev.type === "error") {
        throw new Error(`fill error: ${ev.key}`);
      }
      if (ev.type === "stop_filled") stopCount += 1;
    }
  } finally {
    console.info = origInfo;
  }

  return {
    destination,
    totalMs: Date.now() - started,
    stopCount,
    hopLogs,
  };
}

describe.skipIf(!LIVE)("fill timing spike (live agent)", () => {
  it("should_record_taipei_and_lisbon_3day_fill_timing", async () => {
    const results: SpikeResult[] = [];

    results.push(await runFillSpike("台北", "台北君悦酒店"));
    results.push(await runFillSpike("Lisbon", "Hyatt Regency Lisbon"));

    fs.writeFileSync(
      SPIKE_OUT,
      JSON.stringify({ recorded_at: new Date().toISOString(), results }, null, 2),
    );

    expect(results.every((r) => r.stopCount > 0)).toBe(true);
    expect(results.every((r) => r.totalMs > 0)).toBe(true);
  }, 600_000);
});
