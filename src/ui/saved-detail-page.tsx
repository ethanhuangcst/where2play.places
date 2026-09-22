"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ItineraryDto, ItineraryPlaceSlot } from "@/src/core/itinerary-types";
import type { ChatMessageDto } from "@/src/core/saved-itinerary";
import { itineraryPdfFilename, itineraryToPdfBytes } from "@/src/core/itinerary-pdf";
import { isResolvablePlaceNativeId } from "@/src/core/place-native-id";
import { constraintItemsFromSavedSnapshot } from "@/src/core/plan-intake";
import { resolveErrorKey } from "@/src/i18n/error-key";
import { useLocale, useT } from "@/src/i18n/use-t";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import { downloadPdfBytes } from "@/src/ui/download-pdf";
import { PlanConstraintsPanel } from "@/src/ui/plan-constraints-panel";
import { PlanItineraryView } from "@/src/ui/plan-itinerary-view";
import { PlanTravelTipsPanel, type TravelTipsData } from "@/src/ui/plan-travel-tips-panel";
import { PlaceSheet, type PlaceDetails } from "@/src/ui/place-sheet";
import { SavedChatSnapshotPanel } from "@/src/ui/saved-chat-snapshot-panel";
import { usePageTitle } from "@/src/ui/use-page-title";

type DetailResponse = {
  itinerary: ItineraryDto;
  title: string;
  savedAt: string;
  destination?: string;
  daysCount?: number;
  startDate?: string;
  days?: number;
  travelTips?: TravelTipsData | null;
  messages?: ChatMessageDto[];
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
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState(false);
  const [placeDetailsError, setPlaceDetailsError] = useState<string | null>(null);

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

  const constraintItems = useMemo(() => {
    if (!detail) return [];
    return constraintItemsFromSavedSnapshot({
      destination: detail.destination ?? detail.itinerary.destination,
      startDate: detail.startDate,
      daysCount: detail.days ?? detail.daysCount ?? detail.itinerary.daysCount,
    });
  }, [detail]);

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

  async function openPlaceSheet(slot: ItineraryPlaceSlot, dayIndex: number) {
    setPlaceSheetSlot(slot);
    setPlaceSheetDay(dayIndex);
    setPlaceDetails(null);
    setPlaceDetailsError(null);
    const slotDetails: PlaceDetails = {
      name: slot.name,
      summary: slot.summary,
      ...(slot.photoUrl ? { photos: [slot.photoUrl] } : {}),
      ...(slot.provider ? { provider: slot.provider } : {}),
      ...(slot.nativeId
        ? { sources: [{ provider: slot.provider, native_id: slot.nativeId }] }
        : {}),
    };
    if (!slot.provider || !slot.nativeId || !isResolvablePlaceNativeId(slot.provider, slot.nativeId)) {
      setPlaceDetails(slotDetails);
      setPlaceDetailsLoading(false);
      return;
    }
    setPlaceDetailsLoading(true);
    const destination = (detail?.destination ?? detail?.itinerary.destination ?? "").trim();
    try {
      const data = await authJson<{ ok: boolean; data?: Record<string, unknown> }>(
        `/api/places/${encodeURIComponent(slot.provider)}/${encodeURIComponent(slot.nativeId)}?locale=${locale}` +
          `&name=${encodeURIComponent(slot.name)}` +
          (destination ? `&city=${encodeURIComponent(destination)}` : ""),
      );
      const merged: PlaceDetails = {
        ...slotDetails,
        ...(data.data as PlaceDetails | undefined),
        photos:
          (Array.isArray((data.data as { photos?: unknown })?.photos)
            ? (data.data as { photos: string[] }).photos
            : undefined) ?? slotDetails.photos,
      };
      setPlaceDetails(merged);
    } catch {
      setPlaceDetails(slotDetails);
      if (!slot.photoUrl && !slot.summary?.trim()) {
        setPlaceDetailsError("play.plan.place_sheet_error");
      }
    } finally {
      setPlaceDetailsLoading(false);
    }
  }

  const placeSheetHowToArrive = (() => {
    if (!placeSheetSlot || placeSheetDay == null || !detail) return null;
    const day = detail.itinerary.days.find((d) => d.dayIndex === placeSheetDay);
    if (!day) return null;
    const idx = day.slots.findIndex(
      (s) =>
        s.kind === "place" &&
        s.nativeId === placeSheetSlot.nativeId &&
        s.provider === placeSheetSlot.provider &&
        s.name === placeSheetSlot.name,
    );
    if (idx <= 0) return null;
    const prev = day.slots[idx - 1];
    return prev?.kind === "transit" ? prev.text : null;
  })();

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
        <div className="plan-stack">
          <h1 className="page-title">{detail.title}</h1>
          <p className="page-meta">
            {t("play.saved.detail_meta", {
              date: formatSavedDate(detail.savedAt, locale),
            })}
          </p>
          <PlanConstraintsPanel items={constraintItems} />
          {detail.travelTips ? (
            <PlanTravelTipsPanel
              destination={detail.destination ?? detail.itinerary.destination}
              startDate={detail.startDate ?? ""}
              days={detail.days ?? detail.daysCount ?? detail.itinerary.daysCount}
              data={detail.travelTips}
              loading={false}
              errorKey={null}
            />
          ) : null}
          <SavedChatSnapshotPanel messages={detail.messages ?? []} />
          <PlanItineraryView
            itinerary={detail.itinerary}
            generating={false}
            onOpenPlaceSheet={(slot, dayIndex) => {
              void openPlaceSheet(slot, dayIndex);
            }}
            headerActions={
              <>
                <Link className="btn btn-quiet" href="/saved" data-testid="saved-back-head">
                  {t("play.saved.back_to_list")}
                </Link>
                <button
                  type="button"
                  className="btn"
                  data-testid="plan-export"
                  onClick={() => {
                    void (async () => {
                      const bytes = await itineraryToPdfBytes(detail.itinerary);
                      downloadPdfBytes(bytes, itineraryPdfFilename(detail.itinerary));
                    })();
                  }}
                >
                  {t("play.plan.export_pdf")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="saved-unsave"
                  onClick={() => setConfirmUnsave(true)}
                >
                  {t("play.saved.unsave")}
                </button>
              </>
            }
          />
          <PlaceSheet
            open={placeSheetSlot != null}
            slot={placeSheetSlot}
            dayIndex={placeSheetDay ?? undefined}
            howToArrive={placeSheetHowToArrive}
            onClose={() => {
              setPlaceSheetSlot(null);
              setPlaceSheetDay(null);
              setPlaceDetails(null);
              setPlaceDetailsError(null);
            }}
            details={placeDetails}
            loading={placeDetailsLoading}
            errorKey={placeDetailsError}
          />
        </div>
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
