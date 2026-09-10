"use client";

import { Droplets, Gauge, Sunrise, Sunset } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useLocation } from "@/lib/location-context";

// Simple, well-established comfort bands for the real humidity_pct reading
// — a label derived from the actual number, not an invented data point.
function humidityLabel(pct: number): string {
  if (pct < 30) return "Dry";
  if (pct < 60) return "Comfortable";
  if (pct < 80) return "Humid";
  return "Very humid";
}

// Typical sea-level-adjusted pressure range is roughly 980-1040hPa, average
// ~1013hPa — used only to place the real reading on a gauge and label it,
// not to claim a trend (rising/falling) we have no data to support.
const PRESSURE_MIN = 980;
const PRESSURE_MAX = 1040;

function pressureLabel(hpa: number): string {
  if (hpa < 1000) return "Low";
  if (hpa > 1025) return "High";
  return "Normal";
}

// Open-Meteo's timestamps are already local to the queried place — parsed
// as a plain string, never through `new Date()`, which would silently
// reinterpret them in the viewer's own timezone instead (same reasoning as
// weather-api.ts's timeLabel()).
function minutesOfDay(iso: string): number {
  const timePart = iso.split("T")[1] ?? "00:00";
  const [h, m] = timePart.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function formatClock(iso: string): string {
  const mins = minutesOfDay(iso);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function WeatherMetricsPanel() {
  const { weather } = useLocation();

  if (!weather) return null;

  const humidityPct = Math.round(weather.humidity_pct);
  const pressureHpa = Math.round(weather.pressure_hpa);
  const pressureFillPct = Math.min(
    100,
    Math.max(0, ((pressureHpa - PRESSURE_MIN) / (PRESSURE_MAX - PRESSURE_MIN)) * 100),
  );

  const sunriseMin = minutesOfDay(weather.sunrise);
  const sunsetMin = minutesOfDay(weather.sunset);
  const nowMin = minutesOfDay(weather.current_time);
  const daylightMin = Math.max(0, sunsetMin - sunriseMin);
  const dayProgressPct =
    daylightMin > 0
      ? Math.min(100, Math.max(0, ((nowMin - sunriseMin) / daylightMin) * 100))
      : 0;

  return (
    <div>
      <SectionHeader title="Conditions" />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Droplets size={16} strokeWidth={1.75} />
            <span className="text-sm font-medium">Humidity</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-text-primary">{humidityPct}%</div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent-primary"
              style={{ width: `${humidityPct}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-text-tertiary">{humidityLabel(humidityPct)}</div>
        </div>

        <div className="rounded-lg bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Gauge size={16} strokeWidth={1.75} />
            <span className="text-sm font-medium">Pressure</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-text-primary">{pressureHpa}</div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent-primary"
              style={{ width: `${pressureFillPct}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-text-tertiary">{pressureLabel(pressureHpa)} · hPa</div>
        </div>

        <div className="col-span-2 rounded-lg bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Sunrise size={16} strokeWidth={1.75} />
            <span className="text-sm font-medium">Daylight</span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sunrise size={15} strokeWidth={1.75} className="text-text-tertiary" />
              <span className="text-lg font-semibold text-text-primary">{formatClock(weather.sunrise)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-semibold text-text-primary">{formatClock(weather.sunset)}</span>
              <Sunset size={15} strokeWidth={1.75} className="text-text-tertiary" />
            </div>
          </div>

          <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent-primary"
              style={{ width: `${dayProgressPct}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-text-tertiary">{formatDuration(daylightMin)} of daylight</div>
        </div>
      </div>
    </div>
  );
}
