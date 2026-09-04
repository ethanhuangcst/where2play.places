"use client";

import { useEffect, useRef } from "react";
import type { ItineraryPlaceSlot } from "@/src/core/itinerary-types";
import { useT } from "@/src/i18n/use-t";

type PlaceDetails = {
  name?: string;
  address?: string;
  rating?: number;
  photos?: string[];
  summary?: string;
};

type Props = {
  open: boolean;
  slot: ItineraryPlaceSlot | null;
  dayIndex?: number;
  onClose: () => void;
  details?: PlaceDetails | null;
  loading?: boolean;
  errorKey?: string | null;
};

export function PlaceSheet({
  open,
  slot,
  dayIndex,
  onClose,
  details,
  loading = false,
  errorKey,
}: Props) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !slot) return null;

  return (
    <div
      className="dialog-backdrop"
      data-testid="place-sheet"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog dialog--place"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-sheet-title"
      >
        <header className="dialog__head">
          <h2 id="place-sheet-title">{t("play.plan.place_sheet_title")}</h2>
          <button
            ref={closeRef}
            type="button"
            className="dialog__close"
            data-testid="place-sheet-close"
            onClick={onClose}
          >
            {t("play.plan.place_sheet_close")}
          </button>
        </header>
        <div className="dialog__body place-split">
          <div className="place-panel place-panel--facts">
            <h3>{details?.name ?? slot.name}</h3>
            {loading ? <p>{t("play.plan.place_sheet_loading")}</p> : null}
            {errorKey ? <p>{t(errorKey)}</p> : null}
            {!loading && !errorKey && details?.address ? <p>{details.address}</p> : null}
            {!loading && !errorKey && details?.rating != null ? (
              <p>{String(details.rating)}</p>
            ) : null}
            {!loading && !errorKey && details?.summary ? <p>{details.summary}</p> : null}
            {details?.photos?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={details.photos[0]} alt="" className="place-sheet-photo" />
            ) : null}
          </div>
          <div className="place-panel place-panel--itinerary">
            <h4>{t("play.plan.place_sheet_itinerary")}</h4>
            {dayIndex != null ? (
              <p>{t("play.plan.day_n", { n: String(dayIndex) })}</p>
            ) : null}
            <p>
              {slot.start}–{slot.end}
            </p>
            {slot.mapUrl ? (
              <a
                className="btn btn--ghost"
                href={slot.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="place-sheet-map"
              >
                {t("play.plan.place_sheet_map")}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
