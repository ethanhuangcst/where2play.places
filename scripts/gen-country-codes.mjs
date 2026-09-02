import fs from "node:fs";
import https from "node:https";

const url =
  "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv";

function fetchText(u) {
  return new Promise((resolve, reject) => {
    https
      .get(u, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

/** Minimal RFC-style CSV row parse (handles quoted commas). */
function parseCsvLine(line) {
  const parts = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

const csv = await fetchText(url);
const lines = csv.trim().split("\n").slice(1);
const rows = [];
for (const line of lines) {
  const parts = parseCsvLine(line);
  const a2 = parts[1]?.trim();
  const a3 = parts[2]?.trim();
  if (!a2 || !a3 || a3.length !== 3) continue;
  rows.push([a3, a2]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
const body = rows
  .map(([a3, a2]) => `  { alpha3: "${a3}", alpha2: "${a2}" },`)
  .join("\n");
const out = `/** ISO 3166-1 alpha-3 passport codes with alpha-2 for DisplayNames (ADR-042 safe: codes only). */
export type PassportCountry = { alpha3: string; alpha2: string };

export const PASSPORT_COUNTRIES: readonly PassportCountry[] = [
${body}
] as const;

export const PASSPORT_COUNTRY_CODES: readonly string[] = PASSPORT_COUNTRIES.map((c) => c.alpha3);

const ALPHA3 = new Set(PASSPORT_COUNTRY_CODES);

export function isValidNationality(code: string | null | undefined): boolean {
  if (code == null || code === "") return true;
  return ALPHA3.has(code.toUpperCase());
}
`;
fs.writeFileSync(new URL("../src/core/country-codes.ts", import.meta.url), out);
console.log(`wrote ${rows.length} countries`);
