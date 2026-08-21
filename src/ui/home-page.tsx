"use client";

import Link from "next/link";
import { useT } from "@/src/i18n/use-t";
import { PublicShell } from "@/src/ui/public-shell";
import { LogoLink } from "@/src/ui/logo-link";
import { usePageTitle } from "@/src/ui/use-page-title";

type Props = { signedIn?: boolean };

export default function HomePageClient({ signedIn = false }: Props) {
  const t = useT();
  usePageTitle("play.home.headline");
  const ctaHref = signedIn ? "/plan" : "/register";

  return (
    <PublicShell>
      <main id="content" className="home-main">
        <LogoLink href="/" className="logo logo-home" size={72} />
        <h1 data-testid="home-headline">{t("play.home.headline")}</h1>
        <p className="lead">{t("play.home.lead")}</p>
        <div className="cta-row">
          <Link href={ctaHref} className="btn" data-testid="home-cta">
            {t("play.home.cta")}
          </Link>
          <Link href="/login" className="btn btn-quiet" data-testid="home-login">
            {t("play.home.login")}
          </Link>
        </div>
        {!signedIn ? (
          <p>
            <Link href="/register" data-testid="home-register">
              {t("play.home.register")}
            </Link>
          </p>
        ) : null}
      </main>
    </PublicShell>
  );
}
