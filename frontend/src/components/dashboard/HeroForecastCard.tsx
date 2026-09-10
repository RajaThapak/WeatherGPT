"use client";

import { WeatherIcon } from "./WeatherIcon";
import { heroForecast as mockHero } from "@/lib/mockData";
import type { HeroForecastData } from "@/lib/weather-api";

export function HeroForecastCard({ data }: { data?: HeroForecastData }) {
  const f: HeroForecastData = data ?? mockHero;
  const hasDetail = f.wind !== undefined;

  return (
    <div className="flex h-full min-w-[180px] flex-1 flex-col justify-between rounded-lg bg-gradient-to-br from-accent-primary-soft to-accent-primary-soft-2 p-5 text-text-inverse shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium">{f.day}</span>
        {f.time && <span className="text-xs opacity-65">{f.time}</span>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[44px] font-semibold leading-none">{f.tempC}°</span>
        <WeatherIcon kind={f.kind} size={36} />
      </div>
      {hasDetail ? (
        <span className="-mt-2 text-xs opacity-65">Real Feel {f.realFeelC}°</span>
      ) : (
        f.tempLowC !== undefined && <span className="-mt-2 text-xs opacity-65">Low {f.tempLowC}°</span>
      )}

      {hasDetail && (
        // Pressure/humidity/sunrise/sunset moved to their own widgets in
        // WeatherMetricsPanel — kept only here what has no widget yet.
        <div className="mt-3 flex flex-col gap-1 text-[11px] leading-[1.5] opacity-65">
          <span>Wind: {f.wind}</span>
        </div>
      )}
    </div>
  );
}
