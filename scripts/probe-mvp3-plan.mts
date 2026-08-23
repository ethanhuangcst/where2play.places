/**
 * Live probe: time planItineraryDayByDay phases (operator diagnostic).
 * Usage: PLAN_SLOT_STAGE_MS=0 npx tsx scripts/probe-mvp3-plan.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(import.meta.dirname, "../.env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();
process.env.PLAN_SLOT_STAGE_MS ??= "0";

const { planItineraryDayByDay } = await import("../src/core/plan-day-by-day.ts");
const { defaultProviders } = await import("../src/places-agent/client.ts");

const start = Date.now();
let last = start;

function log(type: string, extra = "") {
  const now = Date.now();
  console.log(`+${now - start}ms (+${now - last}ms) ${type}${extra ? ` ${extra}` : ""}`);
  last = now;
}

const criteria = {
  destination: "London",
  days: 1,
  interests: ["tourist_attraction", "restaurant"],
};

for await (const ev of planItineraryDayByDay(criteria, {
  locale: "en",
  providers: defaultProviders(),
})) {
  if (ev.type === "error") {
    log("error", ev.key);
    process.exit(1);
  }
  if (ev.type === "done") {
    log("done", `days=${ev.itinerary.days.length}`);
    break;
  }
  if (
    ev.type === "phase" ||
    ev.type === "discover_done" ||
    ev.type === "arrange_day_start" ||
    ev.type === "day_highlights" ||
    ev.type === "day_done"
  ) {
    log(ev.type, JSON.stringify(ev).slice(0, 120));
  }
}

console.log(`total ${Date.now() - start}ms`);
