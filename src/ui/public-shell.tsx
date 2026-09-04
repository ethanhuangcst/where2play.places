"use client";

import { useEffect } from "react";
import { useT } from "@/src/i18n/use-t";
import { LocaleSwitch } from "@/src/ui/locale-switch";
import { FamilyFooter } from "@/src/ui/family-footer";

type Props = {
  children: React.ReactNode;
  bodyClass?: string;
  localeCorner?: boolean;
};

export function PublicShell({ children, bodyClass = "shell-public", localeCorner = true }: Props) {
  const t = useT();

  useEffect(() => {
    document.body.className = bodyClass;
    document.body.dataset.style = "travor";
    return () => {
      document.body.className = "";
      delete document.body.dataset.style;
    };
  }, [bodyClass]);

  return (
    <>
      <a className="sr-only" href="#content">
        {t("play.a11y.skip")}
      </a>
      {localeCorner ? (
        <div className="shell-locale">
          <LocaleSwitch />
        </div>
      ) : null}
      {children}
      <FamilyFooter variant="public" />
    </>
  );
}
