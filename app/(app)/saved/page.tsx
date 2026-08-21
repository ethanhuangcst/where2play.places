"use client";

import { useT } from "@/src/i18n/use-t";

export default function SavedPage() {
  const t = useT();
  return (
    <main id="content" className="app-main" data-testid="saved-placeholder">
      <h1 className="page-title">{t("play.saved.page_title")}</h1>
      <p className="lead">{t("play.saved.placeholder")}</p>
    </main>
  );
}
