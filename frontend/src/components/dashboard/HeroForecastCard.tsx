"use client";

import { WeatherIcon } from "./WeatherIcon";
import type { HeroForecastData } from "@/lib/weather-api";

// No `data` means the real fetch hasn't resolved yet — a pulsing skeleton,
// not fake numbers, so a slow load never looks like real (wrong) weather.
function HeroForecastSkeleton() {
  return (
    <div className="flex h-full min-w-[180px] flex-1 animate-pulse flex-col justify-between rounded-lg bg-surface-2 p-5">
      <div className="flex items-start justify-between">
        <div className="h-3.5 w-10 rounded bg-surface-3" />
        <div className="h-3 w-8 rounded bg-surface-3" />
      </div>
      <div className="h-10 w-24 rounded bg-surface-3" />
      <div className="h-3 w-28 rounded bg-surface-3" />
    </div>
  );
}

export function HeroForecastCard({ data }: { data?: HeroForecastData }) {
  if (!data) return <HeroForecastSkeleton />;

  const hasDetail = data.wind !== undefined;

  return (
    <div className="flex h-full min-w-[180px] flex-1 flex-col justify-between rounded-lg bg-gradient-to-br from-accent-primary-soft to-accent-primary-soft-2 p-5 text-text-inverse shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium">{data.day}</span>
        {data.time && <span className="text-xs opacity-65">{data.time}</span>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[44px] font-semibold leading-none">{data.tempC}°</span>
        <WeatherIcon kind={data.kind} size={36} />
      </div>
      {hasDetail ? (
        <span className="-mt-2 text-xs opacity-65">Real Feel {data.realFeelC}°</span>
      ) : (
        data.tempLowC !== undefined && <span className="-mt-2 text-xs opacity-65">Low {data.tempLowC}°</span>
      )}

      {hasDetail && (
        // Pressure/humidity/sunrise/sunset moved to their own widgets in
        // WeatherMetricsPanel — kept only here what has no widget yet.
        <div className="mt-3 flex flex-col gap-1 text-[11px] leading-[1.5] opacity-65">
          <span>Wind: {data.wind}</span>
        </div>
      )}
    </div>
  );
}
