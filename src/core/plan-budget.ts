/** Stable takeoff budget values — not locale strings. */
export const BUDGET_OPTION_KEYS = ["economy", "mid", "comfort"] as const;
export type BudgetOptionKey = (typeof BUDGET_OPTION_KEYS)[number];

const BUDGET_OPTION_I18N: Record<BudgetOptionKey, string> = {
  economy: "play.plan.budget.option_economy",
  mid: "play.plan.budget.option_mid",
  comfort: "play.plan.budget.option_comfort",
};

export function budgetOptionLabel(key: BudgetOptionKey, t: (k: string) => string): string {
  return t(BUDGET_OPTION_I18N[key]);
}

/** Normalize stored / legacy budget strings to a stable option key. */
export function normalizeBudgetKey(raw: string | undefined): BudgetOptionKey | "" {
  const v = raw?.trim() ?? "";
  if (!v) return "";
  if (BUDGET_OPTION_KEYS.includes(v as BudgetOptionKey)) return v as BudgetOptionKey;
  const lower = v.toLowerCase();
  if (/经济|economy|\$ budget|budget/.test(lower)) return "economy";
  if (/舒适|comfort|\$\$\$/.test(lower)) return "comfort";
  if (/中等|mid|\$\$/.test(lower)) return "mid";
  return "";
}

export function budgetKeyForAgent(key: BudgetOptionKey | ""): string | undefined {
  if (key === "economy") return "economy";
  if (key === "comfort") return "comfort";
  return undefined;
}
