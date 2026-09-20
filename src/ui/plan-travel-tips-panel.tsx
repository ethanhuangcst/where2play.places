"use client";

import { useT } from "@/src/i18n/use-t";
import { ymdPlusDays } from "@/src/core/plan-agent-body";
import { iconicPlacesFromTravelTips } from "@/src/core/plan-iconic-parse";

export type TravelTipsData = {
  intro?: string;
  iconic_places?: string[];
  transit?: string;
  weather?: { summary?: string } | null;
  clothing?: string;
  safety?: string;
  visa_label?: string;
  visa_detail?: string;
};

type Props = {
  destination: string;
  startDate: string;
  days: number;
  data: TravelTipsData | null;
  loading: boolean;
  errorKey: string | null;
};

export function PlanTravelTipsPanel({ destination, startDate, days, data, loading, errorKey }: Props) {
  const t = useT();
  const endDate = startDate && days >= 1 ? ymdPlusDays(startDate, days - 1) : "";
  const meta =
    startDate && endDate && destination
      ? `${startDate} – ${endDate} · ${destination}`
      : destination;

  return (
    <section
      className="panel plan-travel-tips"
      data-testid="plan-travel-tips"
      aria-labelledby="travel-tips-title"
    >
      <TravelTipsHead meta={meta} />
      <TravelTipsBody data={data} loading={loading} errorKey={errorKey} />
    </section>
  );
}

function TravelTipsHead({ meta }: { meta: string }) {
  const t = useT();
  return (
    <div className="panel__head plan-travel-tips__head">
      <div className="plan-travel-tips__head-main">
        <h2 id="travel-tips-title">{t("play.plan.travel_tips_title")}</h2>
        {meta ? <span className="plan-travel-tips__meta">{meta}</span> : null}
      </div>
      <TravelTipsToggle />
    </div>
  );
}

function TravelTipsToggle() {
  const t = useT();
  return (
    <button
      type="button"
      className="panel-fold-btn"
      data-testid="plan-travel-tips-toggle"
      aria-expanded="true"
      aria-controls="travel-tips-body"
      aria-label={t("play.plan.travel_tips_fold")}
      onClick={(e) => {
        const section = e.currentTarget.closest(".plan-travel-tips");
        const body = section?.querySelector<HTMLElement>("#travel-tips-body");
        const expanded = e.currentTarget.getAttribute("aria-expanded") === "true";
        e.currentTarget.setAttribute("aria-expanded", expanded ? "false" : "true");
        e.currentTarget.setAttribute(
          "aria-label",
          expanded ? t("play.plan.travel_tips_expand") : t("play.plan.travel_tips_fold"),
        );
        if (body) body.hidden = expanded;
      }}
    >
      <svg className="panel-fold-btn__icon" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <path
          d="M5 12l5-5 5 5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function TravelTipsBody({
  data,
  loading,
  errorKey,
}: {
  data: TravelTipsData | null;
  loading: boolean;
  errorKey: string | null;
}) {
  const t = useT();

  if (loading) {
    return (
      <div className="panel__body plan-travel-tips__body" id="travel-tips-body">
        <p>{t("play.plan.travel_tips_loading")}</p>
      </div>
    );
  }

  if (errorKey) {
    return (
      <div className="panel__body plan-travel-tips__body" id="travel-tips-body">
        <p role="alert">{t(errorKey)}</p>
      </div>
    );
  }

  const unavailable = t("play.plan.travel_tips_unavailable");
  const iconicPlaces = iconicPlacesFromTravelTips(data);
  const weatherText =
    (typeof data?.weather?.summary === "string" && data.weather.summary.trim()) || null;
  const transitText = typeof data?.transit === "string" && data.transit.trim() ? data.transit : null;
  const introText = typeof data?.intro === "string" && data.intro.trim() ? data.intro : null;
  const clothingText =
    typeof data?.clothing === "string" && data.clothing.trim() ? data.clothing : null;
  const safetyText = typeof data?.safety === "string" && data.safety.trim() ? data.safety : null;

  return (
    <div className="panel__body plan-travel-tips__body" id="travel-tips-body">
      <div className="travel-tips-grid">
        <article className="travel-tips-card" data-testid="travel-tips-card-01">
          <header className="travel-tips-card__head">
            <span className="travel-tips-card__idx" aria-hidden="true">
              01
            </span>
            <h3 className="travel-tips-card__title">{t("play.plan.travel_tips_destination")}</h3>
          </header>
          {data?.visa_label ? (
            <p className="travel-tips-card__lead">
              <span className="travel-tips-visa-wrap">
                <span className="travel-tips-visa-link" data-testid="plan-visa-link">
                  {data.visa_label}
                </span>
                {data.visa_detail ? (
                  <span className="travel-tips-popover" role="tooltip">
                    {data.visa_detail}
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          <p className="travel-tips-intro">{introText ?? unavailable}</p>
          {iconicPlaces.length ? (
            <ol className="travel-tips-must-see">
              {iconicPlaces.map((name, index) => (
                <li key={`${index}-${name}`}>{name}</li>
              ))}
            </ol>
          ) : null}
        </article>

        <article className="travel-tips-card" data-testid="travel-tips-card-02">
          <header className="travel-tips-card__head">
            <span className="travel-tips-card__idx" aria-hidden="true">
              02
            </span>
            <h3 className="travel-tips-card__title">{t("play.plan.travel_tips_weather")}</h3>
          </header>
          <p>{weatherText ?? transitText ?? unavailable}</p>
          {transitText && weatherText ? <p className="travel-tips-sub">{transitText}</p> : null}
        </article>

        <article className="travel-tips-card" data-testid="travel-tips-card-03">
          <header className="travel-tips-card__head">
            <span className="travel-tips-card__idx" aria-hidden="true">
              03
            </span>
            <h3 className="travel-tips-card__title">{t("play.plan.travel_tips_clothing")}</h3>
          </header>
          <p>{clothingText ?? unavailable}</p>
        </article>

        <article className="travel-tips-card" data-testid="travel-tips-card-04">
          <header className="travel-tips-card__head">
            <span className="travel-tips-card__idx" aria-hidden="true">
              04
            </span>
            <h3 className="travel-tips-card__title">{t("play.plan.travel_tips_safety")}</h3>
          </header>
          <p>{safetyText ?? unavailable}</p>
        </article>
      </div>
    </div>
  );
}
