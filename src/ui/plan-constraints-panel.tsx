"use client";

import { useT } from "@/src/i18n/use-t";
import type { ConstraintDisplayItem } from "@/src/core/plan-intake";

type Props = {
  items: ConstraintDisplayItem[];
};

const TAKEOFF_COUNT = 8;

function ConstraintCell({ item, t }: { item: ConstraintDisplayItem; t: (key: string) => string }) {
  const pendingClass = item.pending ? "constraint-item__pending" : undefined;
  const testId = item.key === "mustSee" ? "constraint-must-see" : item.key === "tripType" ? "constraint-trip-type" : undefined;

  return (
    <div className="constraint-item">
      <dt>{t(item.labelKey)}</dt>
      {item.chips && item.chips.length > 0 ? (
        <dd className="constraint-must-chips" data-testid={testId}>
          {item.chips.map((name) => (
            <span className="chip" key={name}>
              {name}
            </span>
          ))}
        </dd>
      ) : (
        <dd className={pendingClass} data-testid={testId}>
          {item.value ?? t("play.plan.constraint_pending")}
        </dd>
      )}
    </div>
  );
}

export function PlanConstraintsPanel({ items }: Props) {
  const t = useT();
  const takeoff = items.slice(0, TAKEOFF_COUNT);
  const intake = items.slice(TAKEOFF_COUNT);

  return (
    <section
      className="panel planner-card plan-constraints"
      data-testid="plan-constraints"
      aria-labelledby="constraints-title"
    >
      <div className="panel__head">
        <h2 id="constraints-title">{t("play.plan.constraints_title")}</h2>
      </div>
      <div className="panel__body plan-constraints__body">
        <dl className="constraint-grid">
          {takeoff.map((item) => (
            <ConstraintCell key={item.key} item={item} t={t} />
          ))}
        </dl>
        <dl className="constraint-grid constraint-grid--intake">
          {intake.map((item) => (
            <ConstraintCell key={item.key} item={item} t={t} />
          ))}
        </dl>
      </div>
    </section>
  );
}
