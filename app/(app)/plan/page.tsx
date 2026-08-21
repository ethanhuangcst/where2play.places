"use client";

import { useT } from "@/src/i18n/use-t";

export default function PlanPage() {
  const t = useT();
  return (
    <main id="content" className="app-main" data-testid="plan-placeholder">
      <h1 className="page-title">{t("play.plan.page_title")}</h1>
      <p className="lead">{t("play.plan.placeholder")}</p>
    </main>
  );
}
