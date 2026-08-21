"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson } from "@/src/ui/auth-api";
import { PublicShell } from "@/src/ui/public-shell";
import { LogoLink } from "@/src/ui/logo-link";
import { usePageTitle } from "@/src/ui/use-page-title";

export default function ResetPasswordPageClient() {
  const t = useT();
  const locale = useLocale();
  usePageTitle("play.reset.title");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await authJson("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: fd.get("email"), locale }),
    });
    setSent(true);
  }

  return (
    <PublicShell>
      <main id="content" className="auth-main">
        <LogoLink href="/" />
        <h1>{t("play.reset.title")}</h1>
        {sent ? (
          <p className="callout is-info" data-sent data-testid="reset-sent">
            {t("play.reset.sent")}
          </p>
        ) : null}
        {!sent ? (
          <>
            <p className="lead" data-reset-lead>
              {t("play.reset.lead")}
            </p>
            <form onSubmit={onSubmit} data-testid="auth-form-reset" data-reset-form noValidate>
              <div className="field">
                <label htmlFor="email">{t("play.reset.email")}</label>
                <input id="email" name="email" type="email" autoComplete="email" required data-testid="field-email" />
              </div>
              <button className="btn" type="submit" data-testid="reset-submit">
                {t("play.reset.submit")}
              </button>
            </form>
          </>
        ) : null}
        <p className="auth-links">
          <Link href="/login">{t("play.reset.back")}</Link>
        </p>
      </main>
    </PublicShell>
  );
}
