/** Stable takeoff budget values — not locale strings. */
export const BUDGET_OPTION_KEYS = ["economy", "mid", "luxury"] as const;
export type BudgetOptionKey = (typeof BUDGET_OPTION_KEYS)[number];

const BUDGET_OPTION_I18N: Record<BudgetOptionKey, string> = {
  economy: "play.plan.budget.option_economy",
  mid: "play.plan.budget.option_mid",
  luxury: "play.plan.budget.option_luxury",
};

export function budgetOptionLabel(key: BudgetOptionKey, t: (k: string) => string): string {
  return t(BUDGET_OPTION_I18N[key]);
}

/** Normalize stored / legacy budget strings to a stable option key. */
export function normalizeBudgetKey(raw: string | undefined): BudgetOptionKey | "" {
  const v = raw?.trim() ?? "";
  if (!v) return "";
  if (BUDGET_OPTION_KEYS.includes(v as BudgetOptionKey)) return v as BudgetOptionKey;
  if (v === "comfort") return "luxury";
  const lower = v.toLowerCase();
  if (/经济|economy|\$ budget|^\$[^$]|budget/.test(lower) && !/\$\$/.test(v)) return "economy";
  if (/豪华|luxury|comfort|\$\$\$/.test(lower)) return "luxury";
  if (/适中|中等|mid|moderate|\$\$/.test(lower)) return "mid";
  return "";
}

/** Stable takeoff keys for agent L3 — do not collapse mid/luxury to `premium`. */
export function budgetKeyForAgent(key: BudgetOptionKey | ""): string | undefined {
  if (!key) return undefined;
  return key;
}
