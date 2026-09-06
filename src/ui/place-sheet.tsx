"use client";

import { useEffect, useRef, useState } from "react";
import type { ItineraryPlaceSlot } from "@/src/core/itinerary-types";
import { useT } from "@/src/i18n/use-t";
import { preferSlotDisplayName } from "@/src/ui/place-display-prefer";

export type PlaceDetails = {
  name?: string;
  address?: string;
  rating?: number;
  photos?: string[];
  summary?: string;
  phone?: string;
  hours?: string;
  price_level?: string;
  category?: string;
  provider?: string;
  sources?: Array<{ provider?: string; native_id?: string }>;
};

type Props = {
  open: boolean;
  slot: ItineraryPlaceSlot | null;
  dayIndex?: number;
  /** Prior transit line text for “如何到达” when available. */
  howToArrive?: string | null;
  onClose: () => void;
  details?: PlaceDetails | null;
  loading?: boolean;
  errorKey?: string | null;
};

function firstHttpPhoto(photos: unknown, fallback?: string): string | undefined {
  if (typeof fallback === "string" && fallback.startsWith("http")) return fallback;
  if (Array.isArray(photos)) {
    const hit = photos.find((p) => typeof p === "string" && p.startsWith("http"));
    if (typeof hit === "string") return hit;
  }
  if (typeof photos === "string" && photos.startsWith("http")) return photos;
  return undefined;
}

export function PlaceSheet({
  open,
  slot,
  dayIndex,
  howToArrive = null,
  onClose,
  details,
  loading = false,
  errorKey,
}: Props) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const photoOpenRef = useRef<HTMLButtonElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setLightboxOpen(false);
      return;
    }
    if (!lightboxOpen) {
      closeRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightboxOpen) {
        e.stopPropagation();
        setLightboxOpen(false);
        queueMicrotask(() => photoOpenRef.current?.focus());
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, lightboxOpen]);

  if (!open || !slot) return null;

  const title = preferSlotDisplayName(slot.name, details?.name);
  const photo = firstHttpPhoto(details?.photos, slot.photoUrl);
  const providerLabel =
    slot.provider ?? details?.sources?.[0]?.provider ?? details?.provider ?? "";
  const windowLabel =
    dayIndex != null
      ? `${t("play.plan.day_n", { n: String(dayIndex) })} · ${slot.start}–${slot.end}`
      : `${slot.start}–${slot.end}`;

  return (
    <div
      className="dialog-backdrop is-open"
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
        <header className="place-dialog__bar">
          <h2 id="place-sheet-title" className="place-dialog__heading">
            {t("play.plan.place_sheet_title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-quiet"
            data-testid="place-sheet-close"
            aria-label={t("play.plan.place_sheet_close")}
            onClick={onClose}
          >
            {t("play.plan.place_sheet_close")}
          </button>
        </header>

        <section className="place-panel place-panel--facts" aria-labelledby="place-facts-title">
          <h3 id="place-facts-title" className="place-panel__title">
            {title}
          </h3>
          <div className="place-split">
            <div className="place-split__media">
              {photo ? (
                <button
                  ref={photoOpenRef}
                  type="button"
                  className="place-split__media-open"
                  data-testid="place-sheet-photo-open"
                  aria-label={t("play.plan.place_photo_enlarge")}
                  onClick={() => setLightboxOpen(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="" data-testid="place-sheet-photo" />
                </button>
              ) : (
                <div
                  className="place-split__media-empty"
                  aria-hidden="true"
                  data-testid="place-sheet-photo-empty"
                />
              )}
            </div>
            <div className="place-split__info">
              <p className="place-split__name">{title}</p>
              {loading ? <p className="place-split__meta">{t("play.plan.place_sheet_loading")}</p> : null}
              {errorKey ? <p className="place-split__meta">{t(errorKey)}</p> : null}
              {!loading && !errorKey ? (
                <p className="place-split__meta">
                  {details?.rating != null ? (
                    <span className="place-split__rating">{String(details.rating)}</span>
                  ) : null}
                  {details?.rating != null && details?.category ? (
                    <span aria-hidden="true"> · </span>
                  ) : null}
                  {details?.category ? <span>{details.category}</span> : null}
                  {(details?.rating != null || details?.category) && providerLabel ? (
                    <span aria-hidden="true"> · </span>
                  ) : null}
                  {providerLabel ? <span className="source-id">{providerLabel}</span> : null}
                </p>
              ) : null}
              {!loading && !errorKey ? (
                <dl className="place-facts-compact">
                  {details?.address ? (
                    <div className="place-facts-compact__row">
                      <dt>{t("play.plan.place_sheet_fact_address")}</dt>
                      <dd>{details.address}</dd>
                    </div>
                  ) : null}
                  {details?.phone ? (
                    <div className="place-facts-compact__row">
                      <dt>{t("play.plan.place_sheet_fact_phone")}</dt>
                      <dd>{details.phone}</dd>
                    </div>
                  ) : null}
                  {details?.hours ? (
                    <div className="place-facts-compact__row">
                      <dt>{t("play.plan.place_sheet_fact_hours")}</dt>
                      <dd>{details.hours}</dd>
                    </div>
                  ) : null}
                  {details?.price_level ? (
                    <div className="place-facts-compact__row">
                      <dt>{t("play.plan.place_sheet_fact_price")}</dt>
                      <dd>{details.price_level}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          </div>
        </section>

        <section className="place-panel place-panel--itin" aria-labelledby="place-itin-title">
          <h3 id="place-itin-title" className="place-panel__title">
            {t("play.plan.place_sheet_itinerary")}
          </h3>
          <p className="place-itin-window">{windowLabel}</p>
          {slot.summary || details?.summary ? (
            <p>{details?.summary ?? slot.summary}</p>
          ) : null}
        </section>

        <section className="place-panel place-panel--nav" aria-labelledby="place-nav-title">
          <h3 id="place-nav-title" className="place-panel__title">
            {t("play.plan.place_sheet_how_to_arrive")}
          </h3>
          <ul className="place-nav-list">
            <li>
              {howToArrive?.trim()
                ? howToArrive
                : t("play.plan.place_sheet_nav_fallback")}
            </li>
          </ul>
        </section>

        <div className="dialog__actions">
          {slot.mapUrl ? (
            <a
              className="btn"
              href={slot.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="place-sheet-map"
            >
              {t("play.plan.place_sheet_map")}
            </a>
          ) : null}
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            {t("play.plan.place_sheet_close")}
          </button>
        </div>
      </div>

      {lightboxOpen && photo ? (
        <div
          className="dialog-backdrop place-photo-lightbox is-open"
          data-testid="place-photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t("play.plan.place_photo_lightbox_title")}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxOpen(false);
              queueMicrotask(() => photoOpenRef.current?.focus());
            }
          }}
        >
          <div className="place-photo-lightbox__frame">
            <button
              type="button"
              className="btn btn-quiet place-photo-lightbox__close"
              data-testid="place-photo-lightbox-close"
              aria-label={t("play.plan.place_photo_lightbox_close")}
              onClick={() => {
                setLightboxOpen(false);
                queueMicrotask(() => photoOpenRef.current?.focus());
              }}
            >
              {t("play.plan.place_photo_lightbox_close")}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              className="place-photo-lightbox__img"
              data-testid="place-photo-lightbox-img"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
