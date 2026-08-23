#!/usr/bin/env npx tsx
/**
 * Verify caller key auth + discover_places (batch + NDJSON). No secrets printed.
 * Usage: cd 3.where2play && npx tsx e2e/verify_agent_discover.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(dir: string) {
  try {
    const raw = readFileSync(resolve(dir, ".env.local"), "utf8");
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

loadEnvLocal(resolve(import.meta.dirname, ".."));
loadEnvLocal(resolve(import.meta.dirname, "../../1.places-agent"));

const base =
  process.env.PLACES_AGENT_BASE_URL_LOCAL?.trim() ||
  process.env.PLACES_AGENT_BASE_URL?.trim() ||
  "http://localhost:3010";
const key =
  process.env.PLACES_AGENT_CALLER_KEY_LOCAL?.trim() ||
  process.env.PLACES_AGENT_CALLER_KEY?.trim() ||
  "";

if (!key) {
  console.error("FAIL: no PLACES_AGENT_CALLER_KEY(_LOCAL)");
  process.exit(1);
}

const body = {
  city: "London",
  bounds: { start: "2026-08-23", end: "2026-08-23" },
  origin: { name: "London" },
  locale: "EN",
  providers: ["GOOGLE_MAPS"],
  numDays: 1,
};

async function postDiscover(acceptNdjson: boolean) {
  const res = await fetch(`${base.replace(/\/$/, "")}/v1/discover_places`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(acceptNdjson ? { Accept: "application/x-ndjson" } : {}),
    },
    body: JSON.stringify(body),
  });
  const ctype = res.headers.get("content-type") ?? "";
  const text = await res.text();
  return { status: res.status, ctype, text };
}

async function main() {
  try {
    const health = await fetch(`${base.replace(/\/$/, "")}/v1/health`);
    console.log(`health: ${health.status}`);
  } catch (e) {
    console.error(`FAIL: agent not reachable at ${base}`);
    process.exit(1);
  }

  const batch = await postDiscover(false);
  console.log(`batch: status=${batch.status} ctype=${batch.ctype.split(";")[0]}`);
  if (batch.status !== 200 || batch.ctype.includes("text/html")) {
    console.error("FAIL batch:", batch.text.slice(0, 120));
    process.exit(1);
  }
  let parsed: { ok?: boolean; outcome?: { key?: string } };
  try {
    parsed = JSON.parse(batch.text) as typeof parsed;
  } catch {
    console.error("FAIL: batch not JSON");
    process.exit(1);
  }
  if (!parsed.ok) {
    console.error("FAIL batch envelope:", parsed.outcome?.key ?? "unknown");
    process.exit(1);
  }
  console.log("batch: ok=true");

  const ndjson = await postDiscover(true);
  console.log(`ndjson: status=${ndjson.status} ctype=${ndjson.ctype.split(";")[0]}`);
  if (ndjson.status !== 200) {
    console.error("FAIL ndjson:", ndjson.text.slice(0, 120));
    process.exit(1);
  }
  const lines = ndjson.text.split("\n").filter(Boolean);
  const types = lines.map((l) => {
    try {
      return (JSON.parse(l) as { type?: string }).type;
    } catch {
      return "?";
    }
  });
  console.log(`ndjson events: ${types.join(", ") || "(empty)"}`);
  if (types.includes("error") || (!types.includes("discover_done") && !types.includes("batch"))) {
    console.error("FAIL: ndjson stream error or incomplete");
    process.exit(1);
  }
  console.log("OK: discover_places batch + ndjson");
}

void main();
