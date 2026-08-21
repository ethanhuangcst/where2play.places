"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useT } from "@/src/i18n/use-t";
import { persistLocale } from "@/src/i18n/locale-store";
import { type Locale, LOCALES } from "@/src/core/locales";
import { authJson } from "@/src/ui/auth-api";
import { LogoLink } from "@/src/ui/logo-link";
import { clearAllChatStorage } from "@/src/chat/local-storage";

type Session = { name: string | null; photoUrl: string | null };

export function AppHeader() {
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session>({ name: null, photoUrl: null });
  const [navOpen, setNavOpen] = useState(false);

  const loadSession = useCallback(() => {
    authJson<{ name: string | null; photoUrl?: string | null }>("/api/auth/session")
      .then((s) => setSession({ name: s.name, photoUrl: s.photoUrl ?? null }))
      .catch(() => setSession({ name: null, photoUrl: null }));
  }, []);

  useEffect(() => {
    loadSession();
  }, [pathname, loadSession]);

  useEffect(() => {
    window.addEventListener("where2play:session-changed", loadSession);
    return () => window.removeEventListener("where2play:session-changed", loadSession);
  }, [loadSession]);

  async function logout() {
    clearAllChatStorage();
    await authJson("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function setLocale(next: Locale) {
    await persistLocale(next);
    router.refresh();
  }

  const initial = session.name?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <header className={`app-header${navOpen ? " is-nav-open" : ""}`} data-testid="app-header">
      <div className="app-header__inner">
        <LogoLink href="/plan" />
        <button
          type="button"
          className="menu-toggle btn btn-quiet"
          data-testid="nav-menu"
          onClick={() => setNavOpen((o) => !o)}
        >
          {t("play.nav.menu")}
        </button>
        <nav className="app-nav" aria-label="Main">
          <Link href="/plan" className={pathname.startsWith("/plan") ? "is-active" : ""} data-testid="nav-plan">
            {t("play.nav.plan")}
          </Link>
          <Link href="/saved" className={pathname.startsWith("/saved") ? "is-active" : ""} data-testid="nav-saved">
            {t("play.nav.saved")}
          </Link>
          <Link href="/profile" className={pathname.startsWith("/profile") ? "is-active" : ""} data-testid="nav-profile">
            {t("play.nav.profile")}
          </Link>
        </nav>
        <div className="app-user">
          {session.name ? (
            <span className="hello" data-testid="header-hello">
              {t("play.header.hello", { name: session.name })}
            </span>
          ) : null}
          <span
            className={`avatar${session.photoUrl ? " has-photo" : ""}`}
            data-testid="header-avatar"
            aria-hidden={session.name ? "true" : undefined}
          >
            {session.photoUrl ? <img src={session.photoUrl} alt="" /> : initial}
          </span>
          <div className="app-user__tools">
            <div className="locale-switch" role="group" aria-label={t("play.a11y.locale")}>
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={locale === loc ? "is-active" : ""}
                  data-locale={loc}
                  data-testid={`locale-${loc}`}
                  aria-pressed={locale === loc}
                  onClick={() => setLocale(loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-quiet" data-testid="nav-logout" onClick={logout}>
              {t("play.nav.logout")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
