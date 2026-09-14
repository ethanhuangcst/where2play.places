"use client";

import { useEffect, useState } from "react";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import type { ItineraryDto, PlanBoundaries } from "@/src/core/itinerary-types";
import type { DiscoverPoolRow } from "@/src/core/plan-discover-pool";
import { buildFillRouteDays } from "@/src/core/format-fill-timeline";
import { useT } from "@/src/i18n/use-t";
import { planProviderKey } from "@/src/core/plan-provider-label";
import { debugOriginRows } from "@/src/core/plan-debug-rows";

type CurrentRes = {
  ok?: boolean;
  criteria: PlanBoundaries | null;
  itinerary: ItineraryDto | null;
};

type CandidatesRes = {
  ok?: boolean;
  iconic_places?: string[];
  pool?: DiscoverPoolRow[];
};

type TipsRes = {
  ok?: boolean;
  data?: Record<string, unknown>;
};

function Dump({ title, data }: { title: string; data: unknown }) {
  return (
    <details open>
      <summary>
        <strong>{title}</strong>
      </summary>
      <pre style={{ overflow: "auto", fontSize: "12px", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export default function PlanDebugPage() {
  const t = useT();
  const [current, setCurrent] = useState<CurrentRes | null>(null);
  const [pool, setPool] = useState<DiscoverPoolRow[]>([]);
  const [iconic, setIconic] = useState<string[]>([]);
  const [registryCount, setRegistryCount] = useState(0);
  const [tripCandCount, setTripCandCount] = useState(0);
  const [registryRows, setRegistryRows] = useState<
    Array<{ name: string; kind?: string; provider?: string }>
  >([]);
  const [tips, setTips] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const cur = await authJson<CurrentRes>("/api/plan/current");
        if (cancelled) return;
        setCurrent(cur);
        setError(null);
        const tripId = cur.criteria?.tripId;
        if (!tripId) {
          setPool([]);
          setIconic([]);
          setRegistryCount(0);
          setTripCandCount(0);
          setRegistryRows([]);
          return;
        }
        const cand = await authJson<CandidatesRes>("/api/plan/candidates", {
          method: "POST",
          body: JSON.stringify({ trip_id: tripId }),
        });
        if (!cancelled) {
          setPool(cand.pool ?? []);
          setIconic(cand.iconic_places ?? []);
        }
        const dest = cur.criteria?.destination?.trim() ?? "";
        if (dest) {
          const q = new URLSearchParams({ city: dest, trip_id: tripId });
          const stops = await authJson<{
            registry_count?: number;
            trip_candidates_count?: number;
            registry?: Array<{ name: string; kind?: string; provider?: string }>;
          }>(`/api/plan/debug/stops-pool?${q.toString()}`);
          if (!cancelled) {
            setRegistryCount(stops.registry_count ?? 0);
            setTripCandCount(stops.trip_candidates_count ?? 0);
            setRegistryRows(stops.registry ?? []);
          }
        }
        try {
          const tip = await authJson<TipsRes>("/api/plan/travel-tips", {
            method: "POST",
            body: JSON.stringify({
              destination: cur.criteria?.destination,
              trip_id: tripId,
            }),
          });
          if (!cancelled) setTips(tip.data ?? null);
        } catch {
          /* tips optional */
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof AuthApiError ? err.key : "errors.provider_failed");
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    const onFocus = () => {
      void load();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const itinerary = current?.itinerary ?? null;
  const fillDays = itinerary ? buildFillRouteDays(itinerary, t, { includeTransit: true }) : [];
  const originRows = debugOriginRows(current?.criteria, itinerary);
  const sourceLabel = (provider?: string) => t(planProviderKey(provider));

  return (
    <main id="content" className="app-main" data-testid="plan-debug-page">
      <p role="status">DEBUG — temporary plan dump. Remove before production.</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <Dump title="12 inputs (criteria from /api/plan/current)" data={current?.criteria} />
      <Dump title="Travel tips (4 cards)" data={tips} />
      <Dump title="Stops pool iconic_places" data={iconic} />
      <p data-testid="plan-debug-pool-counts">
        trip.candidates={tripCandCount} · registry={registryCount}
      </p>
      <details open>
        <summary>
          <strong>Origin / stay ({originRows.length})</strong>
        </summary>
        <table>
          <thead>
            <tr>
              <th>name</th>
              <th>kind</th>
              <th>source</th>
            </tr>
          </thead>
          <tbody>
            {originRows.map((row, i) => (
              <tr key={`origin-${i}-${row.name}`}>
                <td>{row.name}</td>
                <td>{row.kind}</td>
                <td data-testid="plan-debug-origin-provider">{sourceLabel(row.provider)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <details open>
        <summary>
          <strong>Registry stops ({registryRows.length})</strong>
        </summary>
        <table>
          <thead>
            <tr>
              <th>name</th>
              <th>kind</th>
              <th>source</th>
            </tr>
          </thead>
          <tbody>
            {registryRows.map((row, i) => (
              <tr key={`reg-${i}-${row.name}`}>
                <td>{row.name}</td>
                <td>{row.kind ?? "attraction"}</td>
                <td data-testid="plan-debug-provider">{sourceLabel(row.provider)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <details open>
        <summary>
          <strong>Trip candidates ({pool.length})</strong>
        </summary>
        <table>
          <thead>
            <tr>
              <th>name</th>
              <th>heat</th>
              <th>kind</th>
              <th>source</th>
            </tr>
          </thead>
          <tbody>
            {pool.map((row, i) => (
              <tr key={`trip-${i}-${row.kind}-${row.name}`}>
                <td>{row.name}</td>
                <td>{row.heat ?? "—"}</td>
                <td>{row.kind}</td>
                <td data-testid="plan-debug-provider">{sourceLabel(row.provider)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <Dump title="Skeleton / itinerary" data={itinerary} />
      <Dump title="Fill route days" data={fillDays} />
    </main>
  );
}
