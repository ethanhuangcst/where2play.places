"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/src/i18n/use-t";
import type { ItineraryDto, ItinerarySlot } from "@/src/core/itinerary-types";

export type LiveHighlights = {
  label: string;
  title: string;
  theme?: string;
  tags: string[];
};

type Props = {
  itinerary: ItineraryDto;
  /** When generating, focus this day tab (usually current arranging day). */
  focusDayIndex?: number;
  /** Total days expected while generating (shows queued tabs). */
  daysTotal?: number;
  /** Slots streaming for the active arrange day (before day_done). */
  liveSlots?: ItinerarySlot[];
  /** Highlights skeleton / incremental title for the arranging day. */
  liveHighlights?: LiveHighlights | null;
  /** Show pending row under live slots. */
  showPending?: boolean;
  /** Header shows generating instead of Updated. */
  generating?: boolean;
  /** Skeleton stop names for unfilled stops on active day. */
  skeletonStops?: { name: string; filled?: boolean; pending?: boolean; mealSlot?: string }[];
  /** Current slot detail hint (itinerary-design §3). */
  slotPreviewText?: string | null;
  saving?: boolean;
  onReplan?: () => void;
  onSave?: () => void;
  /** Open in-page place sheet (plan-46). Map stays external. */
  onOpenPlaceSheet?: (slot: Extract<ItinerarySlot, { kind: "place" }>, dayIndex: number) => void;
};

function formatUpdated(iso: string, locale: string): string {
  try {
    const tag =
      locale === "CN" ? "zh-CN" : locale === "HK" ? "zh-HK" : locale === "TW" ? "zh-TW" : "en";
    return new Date(iso).toLocaleString(tag, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PlanItineraryView({
  itinerary,
  focusDayIndex,
  daysTotal,
  liveSlots = [],
  liveHighlights = null,
  showPending = false,
  generating = false,
  skeletonStops = [],
  slotPreviewText = null,
  saving = false,
  onReplan,
  onSave,
  onOpenPlaceSheet,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const maxDay = Math.max(
    daysTotal ?? 0,
    itinerary.days.reduce((m, d) => Math.max(m, d.dayIndex), 0),
    focusDayIndex ?? 0,
    1,
  );
  const tabIndexes = Array.from({ length: maxDay }, (_, i) => i + 1);
  const [day, setDay] = useState(focusDayIndex ?? itinerary.days[0]?.dayIndex ?? 1);

  useEffect(() => {
    if (focusDayIndex != null) setDay(focusDayIndex);
  }, [focusDayIndex]);

  const activeFromItinerary = itinerary.days.find((d) => d.dayIndex === day);
  const onArrangeDay = generating && day === (focusDayIndex ?? day);
  const showProgressiveOutline =
    day === (focusDayIndex ?? day) && (generating || skeletonStops.length > 0);
  const showingLive = onArrangeDay && (liveSlots.length > 0 || Boolean(liveHighlights) || showPending);
  const slots: ItinerarySlot[] = onArrangeDay && liveSlots.length > 0
    ? liveSlots
    : onArrangeDay && showPending
      ? []
      : (activeFromItinerary?.slots ?? []);
  const highlights = onArrangeDay && liveHighlights
    ? liveHighlights
    : activeFromItinerary?.highlights;
  const meta = onArrangeDay && showPending ? undefined : activeFromItinerary?.meta;

  return (
    <section className="panel" aria-labelledby="itin-title" data-testid="plan-itinerary">
      <div className="panel__head panel__head--itin">
        <h2 id="itin-title">{itinerary.title}</h2>
        <div className="panel__head-actions">
          {onReplan ? (
            <button type="button" className="btn btn-danger" data-testid="replan-open" onClick={onReplan}>
              {t("play.plan.replan")}
            </button>
          ) : null}
          {onSave ? (
            <button
              type="button"
              className="btn btn-quiet"
              data-testid="plan-save"
              disabled={saving || generating}
              onClick={onSave}
            >
              {saving ? t("play.plan.saving") : t("play.plan.save")}
            </button>
          ) : null}
          <button type="button" className="btn" data-testid="plan-export" disabled title={t("play.plan.export_pdf_soon")}>
            {t("play.plan.export_pdf")}
          </button>
        </div>
      </div>
      <div className="panel__body">
        <div className="day-tabs" role="tablist" aria-label={t("play.plan.days_tabs")}>
          {tabIndexes.map((n) => {
            const done = itinerary.days.some((d) => d.dayIndex === n);
            const isOn = n === day;
            const queued = generating && !done && n !== (focusDayIndex ?? day);
            return (
              <button
                key={n}
                type="button"
                className={`day-tab${isOn ? " is-on" : ""}${queued ? " day-tab--queued" : ""}`}
                role="tab"
                aria-selected={isOn}
                data-testid={`plan-day-tab-${n}`}
                disabled={queued}
                onClick={() => {
                  if (!queued) setDay(n);
                }}
              >
                {queued
                  ? t("play.plan.day_n_queued", { n: String(n) })
                  : t("play.plan.day_n", { n: String(n) })}
              </button>
            );
          })}
        </div>

        <div data-day-panel={day}>
          {highlights ? (
            <div className={`highlights${showingLive && liveHighlights ? " highlights--streaming" : ""}`}>
              <p className="highlights__label">{highlights.label}</p>
              <h3 className="highlights__title">{highlights.title}</h3>
              {highlights.theme ? <p className="highlights__theme">{highlights.theme}</p> : null}
              {highlights.tags.length ? (
                <div className="highlights__tags">
                  {highlights.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {meta && (meta.transport || meta.pace || meta.window) ? (
            <p className="day-block__meta">
              {meta.transport ? (
                <span>
                  <strong>{t("play.plan.meta_transport")}</strong> {meta.transport}
                </span>
              ) : null}
              {meta.pace ? (
                <span>
                  <strong>{t("play.plan.meta_pace")}</strong> {meta.pace}
                </span>
              ) : null}
              {meta.window ? (
                <span>
                  <strong>{meta.window}</strong>
                </span>
              ) : null}
            </p>
          ) : null}

          {slotPreviewText && showProgressiveOutline ? (
            <p className="plan-slot-preview" data-testid="plan-slot-preview" role="status">
              {slotPreviewText}
            </p>
          ) : null}

          {slots.map((slot, idx) => {
            if (slot.kind === "transit") {
              return (
                <div
                  key={`t-${idx}`}
                  className={`transit-line slot slot--transit${onArrangeDay && liveSlots.length > 0 ? " is-entering" : ""}`}
                  data-testid="plan-transit-slot"
                >
                  <div className="slot-body">{slot.text}</div>
                </div>
              );
            }
            const isOrigin = slot.placeKind === "stay";
            return (
              <div
                key={`p-${idx}`}
                className={`slot${isOrigin ? " stop-origin" : ""}${onArrangeDay && liveSlots.length > 0 ? " is-entering" : ""}`}
                data-testid={isOrigin ? "stop-origin" : "stop-filled"}
              >
                <div className="slot-time">
                  {slot.start}–{slot.end}
                </div>
                <div className="slot-body">
                  {slot.photoUrl ? (
                    <a
                      className="slot-thumb-link"
                      href={slot.detailsUrl || slot.mapUrl || slot.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="slot-thumb" src={slot.photoUrl} alt="" />
                    </a>
                  ) : (
                    <span className="slot-thumb slot-thumb--empty" aria-hidden="true" />
                  )}
                  <div className="slot-main">
                    <div className="slot-copy">
                      <span className="slot-kind">{slot.placeKind}</span>
                      <h3>{slot.name}</h3>
                      {slot.summary ? <p>{slot.summary}</p> : null}
                    </div>
                    <div className="slot-actions">
                      {onOpenPlaceSheet ? (
                        <button
                          type="button"
                          className="map-link stop-detail-open"
                          data-testid="stop-detail-open"
                          onClick={() => onOpenPlaceSheet(slot, day)}
                        >
                          {t("play.plan.slot_details")}
                        </button>
                      ) : slot.detailsUrl ? (
                        <a
                          className="map-link"
                          href={slot.detailsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("play.plan.slot_details")}
                        </a>
                      ) : null}
                      {slot.mapUrl ? (
                        <a
                          className="map-link stop-map-open"
                          href={slot.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="stop-map-open"
                        >
                          {t("play.plan.slot_map")}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {showPending && day === (focusDayIndex ?? day) ? (
            <div className="slot slot--pending" aria-busy="true" data-testid="plan-slot-pending">
              <div className="slot-time slot-time--skeleton" aria-hidden="true">
                <span className="slot-skel-bar slot-skel-bar--time" />
              </div>
              <div className="slot-body">
                <span className="slot-thumb slot-thumb--skeleton" aria-hidden="true" />
                <div className="slot-main">
                  <div className="slot-copy">
                    <span className="slot-skel-bar slot-skel-bar--kind" aria-hidden="true" />
                    <span className="slot-skel-bar slot-skel-bar--title" aria-hidden="true" />
                    <p className="slot-pending-caption">{t("play.plan.next_stop_loading")}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {skeletonStops.length > 0 && showProgressiveOutline ? (
            <div className="skeleton-day" data-testid="plan-skeleton-day">
              {skeletonStops.map((stop, idx) => (
                <p
                  key={`sk-${idx}`}
                  data-testid="plan-skeleton-stop"
                  className={`skeleton-stop${stop.filled ? " skeleton-stop--filled" : ""}${stop.pending ? " is-pending" : ""}${stop.mealSlot ? " skeleton-stop--meal" : ""}`}
                >
                  <span className="skeleton-stop__idx">{String(idx).padStart(2, "0")}</span>
                  <span className="skeleton-stop__name">{stop.name}</span>
                  {stop.mealSlot ? <span className="skeleton-stop__slot">{stop.mealSlot}</span> : null}
                  {stop.pending ? (
                    <span className="skeleton-stop__slot">{t("play.plan.stop_filling")}</span>
                  ) : null}
                </p>
              ))}
            </div>
          ) : null}

          {!generating && !onArrangeDay ? (
            <p className="page-meta" data-testid="plan-updated">
              {t("play.plan.updated", { time: formatUpdated(itinerary.updatedAt, locale) })}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
