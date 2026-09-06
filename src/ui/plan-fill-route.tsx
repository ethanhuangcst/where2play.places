"use client";

import type { FillRouteDay, FillRouteLeg } from "@/src/core/format-fill-timeline";
import { useT } from "@/src/i18n/use-t";

type Props = {
  days: FillRouteDay[];
  variant: "skeleton" | "fill";
  "data-testid"?: string;
};

function FillLegView({
  leg,
  t,
}: {
  leg: FillRouteLeg;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  if (leg.kind === "transit") {
    return (
      <li className="fill-leg fill-leg--transit">
        <div className="fill-leg__rail" aria-hidden="true">
          <span className="fill-leg__bead" />
        </div>
        <div className="fill-leg__body">
          <p className="fill-transit__when">
            {t("play.plan.timeline_depart_next", { time: leg.depart })}
          </p>
          {leg.modes.length > 0 ? (
            <div className="fill-transit__modes">
              {leg.modes.map((mode, i) => (
                <span
                  key={`${mode.label}-${i}`}
                  className={`fill-mode${mode.recommended ? " fill-mode--rec" : ""}`}
                >
                  {mode.label}
                  {mode.duration ? (
                    <>
                      {" "}
                      <span className="fill-mode__dur">{mode.duration}</span>
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  const legClass =
    leg.kind === "origin"
      ? "fill-leg fill-leg--origin"
      : leg.kind === "meal"
        ? "fill-leg fill-leg--meal"
        : "fill-leg fill-leg--stop";

  const chip =
    leg.kind === "origin" ? t("play.plan.timeline_kind_origin") : leg.kindLabel;

  return (
    <li className={legClass}>
      <div className="fill-leg__rail" aria-hidden="true">
        <span className="fill-leg__bead" />
      </div>
      <div className="fill-leg__body">
        <div className="fill-stop__head">
          <span className="fill-stop__idx">{leg.idx}</span>
          <span className="fill-stop__kind">{chip}</span>
        </div>
        <p className="fill-stop__name">{leg.name}</p>
        {leg.kind !== "origin" && (leg.arrive != null || leg.dwellMin != null) ? (
          <p className="fill-stop__meta">
            {leg.arrive ? (
              <span>{t("play.plan.timeline_arrive", { time: leg.arrive })}</span>
            ) : null}
            {leg.dwellMin != null ? (
              <span>{t("play.plan.timeline_dwell", { min: String(leg.dwellMin) })}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function PlanFillRoute({ days, variant, "data-testid": testId }: Props) {
  const t = useT();
  if (!days.length) return null;

  return (
    <div
      className={`plan-fill-routes${variant === "skeleton" ? " plan-fill-routes--skeleton" : ""}`}
      data-testid={testId}
    >
      {days.map((day) => (
        <section
          key={day.dayIndex}
          className={`fill-route${variant === "skeleton" ? " fill-route--skeleton" : ""}`}
          aria-label={day.theme}
        >
          <header className="fill-route__day">
            <span className="fill-route__day-idx">
              {variant === "skeleton" ? `D${day.dayIndex}` : `Day ${day.dayIndex}`}
            </span>
            <p className="fill-route__day-theme">{day.theme}</p>
          </header>
          <ol className="fill-route__list">
            {day.legs.map((leg, i) => (
              <FillLegView key={`${day.dayIndex}-${i}-${leg.kind}`} leg={leg} t={t} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
