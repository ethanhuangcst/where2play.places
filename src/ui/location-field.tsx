"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useLocale, useT } from "@/src/i18n/use-t";

type Status = "idle" | "resolving" | "ok" | "failed";

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onResolved?: (label: string, lat: number, lng: number) => void;
  /** Called when forward geocode fails — keeps typed text, clears coords at parent. */
  onResolveFailed?: () => void;
  required?: boolean;
  testId?: string;
  showStatus?: boolean;
  initialStatus?: Status;
  action?: ReactNode;
};

type ForwardGeocodeOk = {
  ok?: boolean;
  lat?: number;
  lng?: number;
  city?: string;
  city_en?: string;
  address?: string;
  country?: string;
};

function labelFromGeocode(data: ForwardGeocodeOk, query: string): string {
  const city = data.city?.trim();
  if (city) return city;
  const address = data.address?.trim();
  if (address) return address;
  return query;
}

async function forwardGeocode(
  query: string,
  locale: string,
): Promise<ForwardGeocodeOk | null> {
  const res = await fetch("/api/geocode", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, locale }),
  });
  if (!res.ok) return null;
  return (await res.json()) as ForwardGeocodeOk;
}

export function LocationField({
  id = "location",
  name = "location",
  value,
  onChange,
  onResolved,
  onResolveFailed,
  required,
  testId,
  showStatus = true,
  initialStatus,
  action,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const listId = useId();
  const [status, setStatus] = useState<Status>(
    initialStatus ?? (value.trim() ? "ok" : "idle"),
  );
  const lastResolvedQuery = useRef<string>(value.trim() ? value.trim() : "");

  const suggestions = t("play.register.location_suggestions")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  async function resolveQuery(raw: string) {
    const q = raw.trim();
    if (!q) {
      setStatus("idle");
      lastResolvedQuery.current = "";
      onResolveFailed?.();
      return;
    }
    if (q === lastResolvedQuery.current && status === "ok") return;

    setStatus("resolving");
    const data = await forwardGeocode(q, locale);
    if (
      data?.ok &&
      typeof data.lat === "number" &&
      typeof data.lng === "number" &&
      Number.isFinite(data.lat) &&
      Number.isFinite(data.lng)
    ) {
      const label = labelFromGeocode(data, q);
      lastResolvedQuery.current = label;
      setStatus("ok");
      onChange(label);
      onResolved?.(label, data.lat, data.lng);
      return;
    }
    setStatus("failed");
    lastResolvedQuery.current = "";
    onResolveFailed?.();
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
          const next = e.target.value;
          onChange(next);
          lastResolvedQuery.current = "";
          if (next.trim()) setStatus("idle");
          else setStatus("idle");
        }}
        onBlur={(e) => {
          void resolveQuery(e.currentTarget.value);
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
    </div>
  );

  const sideHint = showStatus ? (
    <p
      className={`location-hint${status === "ok" ? "" : " location-hint--status"}`}
      role="status"
      data-testid="location-hint"
    >
      {status === "resolving"
        ? t("play.register.location_detecting")
        : status === "failed"
          ? t("play.register.location_label_failed")
          : t("play.register.location_source_hint")}
    </p>
  ) : null;

  const fieldRow = (
    <div className="location-row">
      {inputRow}
      {sideHint}
    </div>
  );

  if (action) {
    return (
      <div className="location-with-action">
        {fieldRow}
        {action}
      </div>
    );
  }

  return fieldRow;
}
