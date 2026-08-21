"use client";

import { useT } from "@/src/i18n/use-t";

type Props = { variant?: "app" | "public" };

export function FamilyFooter({ variant = "public" }: Props) {
  const t = useT();
  const cls = variant === "app" ? "family-footer family-footer--app" : "family-footer";
  return (
    <footer className={cls} data-testid="family-footer">
      <div className="family-footer__inner">
        <nav className="family-footer__row" aria-label="places.family">
          <span className="family-footer__label">places.family:</span>
          <span className="family-footer__current" data-testid="family-current">
            <img src="/play-logo.png" alt="" width={18} height={18} />
            <span>where2play.place</span>
          </span>
          <span className="family-footer__sep" aria-hidden="true">
            ·
          </span>
          <a
            className="family-footer__link"
            href="https://what2eat.food"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/food-logo.png" alt="" width={18} height={18} />
            <span>what2eat.food</span>
          </a>
          <span className="family-footer__sep" aria-hidden="true">
            ·
          </span>
          <a
            className="family-footer__link"
            href="https://places.agent-mate.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/agent-logo.png" alt="" width={18} height={18} />
            <span>places.agent-mate.ai</span>
          </a>
        </nav>
        <span className="family-footer__copy">{t("play.footer.copyright")}</span>
      </div>
    </footer>
  );
}
