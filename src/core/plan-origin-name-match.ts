/**
 * S7: user origin query vs vendor place name — containment + global brand aliases.
 * Not a per-city hotel encyclopedia (ADR-042).
 */

/** Global brand token groups (any token in a group covers any other in the group). */
const BRAND_ALIAS_GROUPS: string[][] = [
  ["hyatt", "凯悦", "凱悅"],
  ["hilton", "希尔顿", "希爾頓"],
  ["marriott", "万豪", "萬豪"],
  ["sheraton", "喜来登", "喜來登"],
  ["intercontinental", "洲际", "洲際"],
  ["holiday inn", "假日"],
  ["novotel", "诺富特", "諾富特"],
  ["ibis", "宜必思"],
  ["ritz", "丽思", "麗思"],
  ["four seasons", "四季"],
];

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s\-·・.。，,、]/g, "");
}

/** Split user query into tokens: CJK chars as 1–2 char chunks + latin words. */
export function tokenizeOriginQuery(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const tokens: string[] = [];
  // Latin / digit words
  for (const m of q.matchAll(/[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*/g)) {
    const w = m[0]!.trim().toLowerCase();
    if (w) tokens.push(w);
  }
  // CJK runs: emit each character and also 2-char windows for compounds like 湖滨 / 凯悦
  for (const m of q.matchAll(/[\u4e00-\u9fff]+/g)) {
    const run = m[0]!;
    for (let i = 0; i < run.length; i++) {
      tokens.push(run[i]!);
      if (i + 1 < run.length) tokens.push(run.slice(i, i + 2));
    }
  }
  // Prefer longer tokens: unique by normalized form, keep meaningful length
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens.sort((a, b) => b.length - a.length)) {
    const n = normalizeForMatch(t);
    if (n.length < 1) continue;
    if (seen.has(n)) continue;
    // Skip single CJK if covered by a longer kept token later — keep singles for coverage check
    seen.add(n);
    out.push(t);
  }
  return out;
}

function brandCovers(userToken: string, placeNorm: string): boolean {
  const u = normalizeForMatch(userToken);
  if (!u) return false;
  for (const group of BRAND_ALIAS_GROUPS) {
    const norms = group.map(normalizeForMatch);
    if (!norms.includes(u) && !norms.some((g) => u.includes(g) || g.includes(u))) continue;
    if (norms.some((g) => g && placeNorm.includes(g))) return true;
  }
  return false;
}

/**
 * Every significant user token must appear in the place name (or via brand alias).
 * Significant = latin words length≥2, or CJK length≥2 (prefer compounds over single chars when compounds exist).
 */
export function originNameTokensCovered(userQuery: string, placeName: string): boolean {
  const placeNorm = normalizeForMatch(placeName);
  if (!placeNorm) return false;

  const raw = tokenizeOriginQuery(userQuery);
  // Prefer 2+ char CJK and latin words; if only singles, use them
  let significant = raw.filter((t) => {
    const n = normalizeForMatch(t);
    if (/^[a-z0-9]/.test(n)) return n.length >= 2;
    return n.length >= 2;
  });
  if (!significant.length) {
    significant = raw.filter((t) => normalizeForMatch(t).length >= 1);
  }
  // Drop singles that are substrings of a longer significant token we already have
  significant = significant.filter((t) => {
    const n = normalizeForMatch(t);
    if (n.length >= 2) return true;
    return !significant.some((o) => {
      const on = normalizeForMatch(o);
      return on.length > n.length && on.includes(n);
    });
  });

  if (!significant.length) return false;

  return significant.every((t) => {
    const n = normalizeForMatch(t);
    if (placeNorm.includes(n)) return true;
    return brandCovers(t, placeNorm);
  });
}

function cjkLen(s: string): number {
  return [...s].filter((ch) => /[\u4e00-\u9fff]/.test(ch)).length;
}

function primaryVenueTitle(placeName: string): string {
  return placeName
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\u4e00-\u9fff]*[路街巷][\u4e00-\u9fff0-9号分店]*/g, "")
    .trim();
}

/** Query appears only inside a road / street / number fragment (or its parentheses). */
function queryOnlyInRoadFragment(queryNorm: string, placeName: string): boolean {
  const stripped = placeName
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\u4e00-\u9fff]*[路街巷][\u4e00-\u9fff0-9号]*/g, "");
  const rest = normalizeForMatch(stripped);
  const full = normalizeForMatch(placeName);
  return full.includes(queryNorm) && !rest.includes(queryNorm);
}

/**
 * Full name match: unique auto-hit only when the query is the venue title
 * (or a complete Latin multi-word name), not a short CJK fragment or road token.
 */
export function isFullOriginNameMatch(userQuery: string, placeName: string): boolean {
  const qText = stripOriginParenthetical(userQuery);
  const q = normalizeForMatch(qText);
  const nameNorm = normalizeForMatch(placeName);
  if (!q || !nameNorm) return false;

  if (/[\u4e00-\u9fff]/.test(qText)) {
    const titleNorm = normalizeForMatch(primaryVenueTitle(placeName));
    if (titleNorm && titleNorm === q) return true;
    if (cjkLen(qText) < 4 && q !== titleNorm) return false;
    if (!nameNorm.includes(q)) return false;
    return !queryOnlyInRoadFragment(q, placeName);
  }

  const queryWords = (userQuery.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length >= 2,
  );
  const placeWords = new Set(placeName.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  if (!queryWords.length) return false;
  const matched = queryWords.filter((w) => placeWords.has(w));
  if (matched.length >= 2 && matched.length >= queryWords.length - 1) return true;
  return nameNorm.includes(q);
}

export function pickAutoMatchingOrigin(
  userQuery: string,
  cards: Array<{ name: string; location?: { lat?: number; lng?: number } }>,
): { name: string; location?: { lat?: number; lng?: number } } | null {
  const matches = cards.filter((c) => c.name?.trim() && isFullOriginNameMatch(userQuery, c.name));
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** Brand-only query (e.g. 凯悦 / Hyatt) — show A/B/C similar places, do not auto-hit. */
export function isBrandOnlyOriginQuery(query: string): boolean {
  const q = normalizeForMatch(query);
  if (!q) return false;
  for (const group of BRAND_ALIAS_GROUPS) {
    if (group.some((t) => normalizeForMatch(t) === q)) return true;
  }
  return false;
}

/** Expand CJK brand-only text so Google searchText can match Latin hotel names.
 * ADR-053: strip parenthetical branch labels (钟楼回民街店) before search.
 */
export function stripOriginParenthetical(query: string): string {
  return query
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function originSearchQuery(userQuery: string): string {
  const q = stripOriginParenthetical(userQuery);
  if (!q) return "";
  if (/[A-Za-z]/.test(q)) return q;
  for (const group of BRAND_ALIAS_GROUPS) {
    const latin = group.find((t) => /^[a-z]/i.test(t));
    if (!latin) continue;
    const cjkHits = group.filter((t) => /[\u4e00-\u9fff]/.test(t));
    if (cjkHits.some((c) => q.includes(c))) return `${latin} ${q}`;
  }
  return q;
}
