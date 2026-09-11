"use client";

import { useLocation } from "@/lib/location-context";
import { toRainChance } from "@/lib/weather-api";

const BANDS = ["Heavy", "Sunny", "Rainy"];

export function RainChart() {
  const { weather } = useLocation();
  const bars = weather ? toRainChance(weather) : null;

  return (
    <div className="flex h-[190px] flex-col rounded-lg bg-surface-1 p-5">
      <h2 className="mb-3 text-base font-semibold text-text-primary">Chance of rain</h2>

      <div className="flex flex-1 gap-3">
        <div className="flex flex-col justify-between py-1 text-right text-[11px] text-text-tertiary">
          {BANDS.map((band) => (
            <span key={band}>{band}</span>
          ))}
        </div>

        <div className="relative flex flex-1 items-end justify-between gap-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full flex-col justify-between">
            {BANDS.map((band) => (
              <div key={band} className="h-px bg-border-subtle" />
            ))}
          </div>

          {/* No real data yet — a pulsing skeleton, not an invented chart. */}
          {!bars &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="h-[35%] w-[55%] animate-pulse rounded-t-sm bg-surface-3" />
                <div className="h-2.5 w-6 animate-pulse rounded bg-surface-3" />
              </div>
            ))}

          {bars?.map((bar, i) => (
            <div key={`${bar.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className="w-[55%] rounded-t-sm bg-accent-primary"
                style={{
                  height: `${Math.max(bar.value * 100, 6)}%`,
                  opacity: 0.4 + bar.value * 0.6,
                }}
              />
              <span className="text-[10px] text-text-tertiary">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
