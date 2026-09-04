"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ItineraryDto } from "@/src/core/itinerary-types";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import { PlanItineraryView } from "@/src/ui/plan-itinerary-view";
import { PlaceSheet } from "@/src/ui/place-sheet";
import { usePageTitle } from "@/src/ui/use-page-title";
import type { ItineraryPlaceSlot } from "@/src/core/itinerary-types";

type DetailResponse = {
  itinerary: ItineraryDto;
  title: string;
  savedAt: string;
};

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

export default function SavedDetailPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [confirmUnsave, setConfirmUnsave] = useState(false);
  const [unsaving, setUnsaving] = useState(false);
  const [placeSheetSlot, setPlaceSheetSlot] = useState<ItineraryPlaceSlot | null>(null);
  const [placeSheetDay, setPlaceSheetDay] = useState<number | null>(null);

  usePageTitle(detail?.title ?? "play.saved.page_title");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authJson<DetailResponse>(`/api/itineraries/${id}`);
        if (!cancelled) setDetail(data);
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
  }, [id]);

  async function onConfirmUnsave() {
    if (unsaving) return;
    setUnsaving(true);
    try {
      await authJson(`/api/saved/${id}`, { method: "DELETE" });
      router.push("/saved");
      router.refresh();
    } catch (err) {
      setErrorKey(
        err instanceof AuthApiError ? resolveErrorKey(err.key) : "play.errors.network",
      );
      setConfirmUnsave(false);
    } finally {
      setUnsaving(false);
    }
  }

  return (
    <main id="content" className="app-main" data-testid="saved-detail-page">
      <Link className="saved-back" href="/saved" data-testid="saved-back">
        {t("play.saved.back_to_list")}
      </Link>

      {errorKey ? (
        <p className="error" role="alert" data-testid="saved-detail-error">
          {t(errorKey)}
        </p>
      ) : null}

      {!detail ? (
        <p className="lead">{t("play.saved.loading")}</p>
      ) : (
        <>
          <h1 className="page-title">{detail.title}</h1>
          <p className="page-meta">
            {t("play.saved.detail_meta", {
              date: formatSavedDate(detail.savedAt, locale),
            })}
          </p>
          <PlanItineraryView
            itinerary={detail.itinerary}
            generating={false}
            onOpenPlaceSheet={(slot, dayIndex) => {
              setPlaceSheetSlot(slot);
              setPlaceSheetDay(dayIndex);
            }}
          />
          <PlaceSheet
            open={placeSheetSlot != null}
            slot={placeSheetSlot}
            dayIndex={placeSheetDay ?? undefined}
            onClose={() => {
              setPlaceSheetSlot(null);
              setPlaceSheetDay(null);
            }}
          />
          <div className="plan-actions saved-detail-actions">
            <Link className="btn btn-quiet" href="/saved">
              {t("play.saved.back_to_list")}
            </Link>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="saved-unsave"
              onClick={() => setConfirmUnsave(true)}
            >
              {t("play.saved.unsave")}
            </button>
          </div>
        </>
      )}

      {confirmUnsave ? (
        <div className="dialog-backdrop is-open" role="presentation">
          <div
            className="dialog"
            role="alertdialog"
            aria-labelledby="unsave-title"
            aria-describedby="unsave-desc"
            data-testid="saved-unsave-dialog"
          >
            <h2 id="unsave-title">{t("play.saved.unsave_title")}</h2>
            <p id="unsave-desc">{t("play.saved.unsave_body")}</p>
            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn-quiet"
                data-testid="saved-unsave-cancel"
                onClick={() => setConfirmUnsave(false)}
              >
                {t("play.common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                data-testid="saved-unsave-confirm"
                disabled={unsaving}
                onClick={() => void onConfirmUnsave()}
              >
                {unsaving ? t("play.saved.unsaving") : t("play.saved.unsave_confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
