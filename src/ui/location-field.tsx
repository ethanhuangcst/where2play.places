"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocale, useT } from "@/src/i18n/use-t";
import { isCoordString, parseCoordString } from "@/src/core/location";

type Status = "detecting" | "ok" | "failed";

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onResolved?: (label: string, lat: number, lng: number) => void;
  required?: boolean;
  testId?: string;
  showStatus?: boolean;
  initialStatus?: Status;
  action?: ReactNode;
};

const LOCATE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

async function resolveCoords(
  lat: number,
  lng: number,
  locale: string,
): Promise<{ label: string; lat: number; lng: number } | null> {
  const res = await fetch("/api/geocode/reverse", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, locale }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { label: string; lat: number; lng: number };
}

export function LocationField({
  id = "location",
  name = "location",
  value,
  onChange,
  onResolved,
  required,
  testId,
  showStatus = true,
  initialStatus,
  action,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const listId = useId();
  const [status, setStatus] = useState<Status>(initialStatus ?? (value ? "ok" : "detecting"));
  const [loading, setLoading] = useState(false);
  const [labelFailed, setLabelFailed] = useState(false);
  const backfillAttempted = useRef(false);

  const suggestions = t("play.register.location_suggestions")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  async function applyCoords(lat: number, lng: number) {
    setLabelFailed(false);
    setStatus("detecting");
    const resolved = await resolveCoords(lat, lng, locale);
    if (resolved?.label) {
      setStatus("ok");
      onChange(resolved.label);
      onResolved?.(resolved.label, resolved.lat, resolved.lng);
      return;
    }
    setStatus("ok");
    setLabelFailed(true);
    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    onChange(fallback);
    onResolved?.(fallback, lat, lng);
  }

  useEffect(() => {
    if (initialStatus || value) return;
    if (!navigator.geolocation) {
      setStatus("failed");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => setStatus("failed"),
      { timeout: 8000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-time detect only
  }, [initialStatus, value]);

  useEffect(() => {
    if (!value || !isCoordString(value) || backfillAttempted.current) return;
    backfillAttempted.current = true;
    const coords = parseCoordString(value);
    if (!coords) return;
    void applyCoords(coords.lat, coords.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot backfill
  }, [value]);

  function detect() {
    if (!navigator.geolocation) {
      setStatus("failed");
      return;
    }
    setLoading(true);
    setStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        void applyCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLoading(false);
        setStatus("failed");
      },
      { timeout: 8000 },
    );
  }

  const inputRow = (
    <div className="location-field">
      <input
        id={id}
        name={name}
        type="text"
        list={listId}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setLabelFailed(false);
          if (e.target.value.trim()) setStatus("ok");
        }}
        placeholder={t("play.register.location_placeholder")}
        required={required}
        data-testid={testId}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button
        type="button"
        className={`location-detect${loading ? " is-loading" : ""}`}
        aria-label={t("play.register.location_use_current")}
        onClick={detect}
      >
        {LOCATE_ICON}
      </button>
    </div>
  );

  return (
    <>
      {showStatus ? (
        <>
          <p
            className={`hint location-status${status === "ok" ? " is-ok" : ""}`}
            role="status"
            hidden={status === "failed"}
          >
            {status === "detecting"
              ? t("play.register.location_detecting")
              : status === "ok"
                ? t("play.register.location_detected")
                : t("play.register.location_failed")}
          </p>
          {labelFailed ? (
            <p className="hint location-status" role="status">
              {t("play.register.location_label_failed")}
            </p>
          ) : null}
          {status === "failed" ? (
            <p className="hint location-status" data-location-failed role="status">
              {t("play.register.location_failed")}
            </p>
          ) : null}
        </>
      ) : null}
      {action ? (
        <div className="location-with-action">
          {inputRow}
          {action}
        </div>
      ) : (
        inputRow
      )}
    </>
  );
}
