"use client";

import { useEffect } from "react";
import { useT } from "@/src/i18n/use-t";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();

  useEffect(() => {
    document.body.className = "";
    return () => {
      document.body.className = "";
    };
  }, []);

  return (
    <>
      <a className="sr-only" href="#content">
        {t("play.a11y.skip")}
      </a>
      {children}
    </>
  );
}
