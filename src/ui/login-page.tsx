"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/src/i18n/use-t";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import { PublicShell } from "@/src/ui/public-shell";
import { LogoLink } from "@/src/ui/logo-link";
import { PasswordField } from "@/src/ui/password-field";
import { usePageTitle } from "@/src/ui/use-page-title";

export default function LoginPageClient() {
  const t = useT();
  const router = useRouter();
  usePageTitle("play.login.title");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorKey(null);
    const fd = new FormData(e.currentTarget);
    const body = { email: fd.get("email"), password: fd.get("password") };
    try {
      await authJson("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
      router.push("/plan");
      router.refresh();
    } catch (err) {
      const key = err instanceof AuthApiError ? err.key : "errors.login_failed";
      setErrorKey(resolveErrorKey(key === "errors.validation" ? "errors.login_failed" : key));
    }
  }

  return (
    <PublicShell>
      <main id="content" className="auth-main">
        <LogoLink href="/" />
        <h1>{t("play.login.title")}</h1>
        <p className="error" data-error role="alert" hidden={!errorKey}>
          {errorKey ? t(errorKey) : t("play.errors.login_failed")}
        </p>
        <form onSubmit={onSubmit} data-testid="auth-form-login" noValidate>
          <div className="field">
            <label htmlFor="email">{t("play.login.email")}</label>
            <input id="email" name="email" type="email" autoComplete="username" required data-testid="field-email" />
          </div>
          <div className="field">
            <label htmlFor="password">{t("play.login.password")}</label>
            <PasswordField id="password" name="password" autoComplete="current-password" required testId="field-password" />
          </div>
          <button className="btn" type="submit" data-testid="login-submit">
            {t("play.login.submit")}
          </button>
        </form>
        <p className="auth-links">
          <Link href="/reset-password">{t("play.login.reset_link")}</Link>
          <Link href="/register">{t("play.login.register_link")}</Link>
        </p>
      </main>
    </PublicShell>
  );
}
