"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/src/i18n/use-t";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import { PublicShell } from "@/src/ui/public-shell";
import { LogoLink } from "@/src/ui/logo-link";
import { usePageTitle } from "@/src/ui/use-page-title";

export default function SetPasswordPageClient() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const modeReset = params.get("mode") === "reset" || Boolean(token);
  const sessionError = params.get("error") === "session";
  usePageTitle("play.set_password.title");

  const [done, setDone] = useState(params.get("done") === "1");
  const [sessionExpired, setSessionExpired] = useState(sessionError);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("done") === "1") setDone(true);
  }, [params]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorKey(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("new") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password !== confirm) {
      setErrorKey("play.errors.password_mismatch");
      return;
    }
    try {
      await authJson("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token: token || undefined, password, confirmPassword: confirm }),
      });
      router.replace("/set-password?done=1");
      setDone(true);
    } catch (err) {
      const key = err instanceof AuthApiError ? err.key : "errors.validation";
      const resolved = resolveErrorKey(key);
      if (resolved === "play.errors.token_expired" || key === "errors.token_expired") {
        setSessionExpired(true);
      } else {
        setErrorKey(resolved);
      }
    }
  }

  return (
    <PublicShell>
      <main id="content" className="auth-main">
        <LogoLink href="/" />

        <div data-set-done hidden={!done}>
          <h1>{t("play.set_password.done_title")}</h1>
          <p className="lead">{t("play.set_password.done_lead")}</p>
          <Link className="btn" href="/login">
            {t("play.set_password.sign_in")}
          </Link>
        </div>

        <div data-set-form hidden={done}>
          <h1>{t("play.set_password.title")}</h1>
          {!modeReset ? (
            <p className="lead" data-set-empty-lead>
              {t("play.set_password.lead")}
            </p>
          ) : null}
          {modeReset ? (
            <p className="lead" data-set-reset-lead>
              {t("play.set_password.reset_lead")}
            </p>
          ) : null}

          {sessionExpired ? (
            <div className="callout is-warn" data-set-error-session>
              <h2>{t("play.errors.reset_link_expired_title")}</h2>
              <p>{t("play.errors.reset_link_expired_body")}</p>
              <p>
                <Link className="btn" href="/reset-password">
                  {t("play.errors.reset_link_expired_action")}
                </Link>
              </p>
            </div>
          ) : null}

          {!sessionExpired ? (
            <form onSubmit={onSubmit} data-testid="auth-form-set-password" noValidate>
              <div data-set-fields>
                <div className="field">
                  <label htmlFor="new">{t("play.set_password.new")}</label>
                  <input id="new" name="new" type="password" autoComplete="new-password" required minLength={8} data-testid="field-password" />
                </div>
                <div className="field">
                  <label htmlFor="confirm">{t("play.set_password.confirm")}</label>
                  <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} data-testid="field-confirm-password" />
                </div>
                {errorKey ? (
                  <p className="error" role="alert">
                    {t(errorKey)}
                  </p>
                ) : null}
                <button className="btn" type="submit" data-testid="set-password-submit">
                  {t("play.set_password.submit")}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </main>
    </PublicShell>
  );
}
