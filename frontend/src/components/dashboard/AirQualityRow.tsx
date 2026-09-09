"use client";

import { useEffect, useState } from "react";
import { useLocation } from "@/lib/location-context";
import { fetchAirQuality, categoryColor, type AirQualityResponse } from "@/lib/air-quality-api";

const POLLUTANTS: { key: keyof AirQualityResponse; label: string; unit: string }[] = [
  { key: "pm2_5", label: "PM2.5", unit: "µg/m³" },
  { key: "pm10", label: "PM10", unit: "µg/m³" },
  { key: "ozone", label: "Ozone", unit: "µg/m³" },
  { key: "nitrogen_dioxide", label: "NO₂", unit: "µg/m³" },
  { key: "carbon_monoxide", label: "CO", unit: "µg/m³" },
];

export function AirQualityRow() {
  const { location } = useLocation();
  const [aq, setAq] = useState<AirQualityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchAirQuality(location.lat, location.lon)
      .then((data) => !cancelled && setAq(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lon]);

  return (
    <div className="no-scrollbar flex h-[190px] gap-4 overflow-x-auto">
      <div className="flex h-full flex-[1.5] min-w-[220px] flex-col justify-between rounded-lg bg-gradient-to-br from-accent-primary-soft to-accent-primary-soft-2 p-5 text-text-inverse shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <span className="text-sm font-medium">Air Quality Index</span>

        {error && <span className="text-xs opacity-70">Couldn&apos;t load air quality</span>}
        {!error && !aq && <span className="text-xs opacity-70">Loading…</span>}
        {aq && (
          <>
            <span className="text-[44px] font-semibold leading-none">{aq.us_aqi}</span>
            <div className="-mt-2 flex items-center gap-1.5 text-xs opacity-80">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(aq.category) }} />
              {aq.category}
            </div>
          </>
        )}
        <span className="mt-3 text-[11px] opacity-60">US AQI scale (0–500, lower is better)</span>
      </div>

      {POLLUTANTS.map((p) => (
        <div
          key={p.key}
          className="flex h-full min-w-[92px] flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-surface-1 px-3 py-4"
        >
          <span className="text-[13px] font-medium text-text-secondary">{p.label}</span>
          <span className="text-xl font-semibold text-text-primary">
            {aq ? Math.round(aq[p.key] as number) : "–"}
          </span>
          <span className="text-[10px] text-text-tertiary">{p.unit}</span>
        </div>
      ))}
    </div>
  );
}
