"use client";

import { useT } from "@/src/i18n/use-t";
import type { ConstraintDisplayItem } from "@/src/core/plan-intake";

type Props = {
  items: ConstraintDisplayItem[];
};

export function PlanConstraintsPanel({ items }: Props) {
  const t = useT();

  return (
    <section
      className="panel planner-card plan-constraints"
      data-testid="plan-constraints"
      aria-labelledby="constraints-title"
    >
      <div className="panel__head">
        <h2 id="constraints-title">{t("play.plan.constraints_title")}</h2>
      </div>
      <div className="panel__body">
        <dl className="constraint-grid">
          {items.map((item) => (
            <div key={item.key} className="constraint-item">
              <dt>{t(item.labelKey)}</dt>
              <dd
                className={item.pending ? "constraint-item__pending" : undefined}
                data-testid={item.key === "mustSee" ? "constraint-must-see" : undefined}
              >
                {item.value ?? t("play.plan.constraint_pending")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
