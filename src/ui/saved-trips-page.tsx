"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedTripListItem } from "@/src/core/saved-itinerary";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import { usePageTitle } from "@/src/ui/use-page-title";

type SavedListResponse = { trips: SavedTripListItem[] };

function formatSavedDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "CN" ? "zh-CN" : locale === "HK" ? "zh-HK" : locale === "TW" ? "zh-TW" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function SavedTripsPage() {
  const t = useT();
  const locale = useLocale();
  usePageTitle("play.saved.page_title");

  const [trips, setTrips] = useState<SavedTripListItem[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authJson<SavedListResponse>("/api/saved");
        if (!cancelled) setTrips(data.trips);
      } catch (err) {
        if (!cancelled) {
          setErrorKey(
            err instanceof AuthApiError ? resolveErrorKey(err.key) : "play.errors.network",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main id="content" className="app-main" data-testid="saved-page">
      <h1 className="page-title">{t("play.saved.page_title")}</h1>
      <p className="page-meta">{t("play.saved.page_meta")}</p>

      {errorKey ? (
        <p className="error" role="alert" data-testid="saved-error">
          {t(errorKey)}
        </p>
      ) : null}

      {trips === null ? (
        <p className="lead">{t("play.saved.loading")}</p>
      ) : trips.length === 0 ? (
        <div className="saved-empty" data-testid="saved-empty">
          <p className="lead">{t("play.saved.empty")}</p>
          <Link className="btn" href="/plan" data-testid="saved-empty-cta">
            {t("play.saved.empty_cta")}
          </Link>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              className="trip-card"
              href={`/saved/${trip.id}`}
              data-testid="trip-card"
            >
              {trip.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="trip-card__media" src={trip.coverUrl} alt="" />
              ) : (
                <div className="trip-card__media trip-card__media--placeholder" aria-hidden="true" />
              )}
              <div className="trip-card__body">
                <h2>{trip.title}</h2>
                <p className="trip-card__meta">
                  {t("play.saved.card_meta", {
                    days: trip.daysCount,
                    date: formatSavedDate(trip.savedAt, locale),
                  })}
                </p>
                {trip.summary ? <p className="page-meta">{trip.summary}</p> : null}
                <div className="trip-card__actions">
                  <span className="btn btn-quiet">{t("play.saved.open")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
