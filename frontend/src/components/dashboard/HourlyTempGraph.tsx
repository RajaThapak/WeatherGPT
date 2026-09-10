"use client";

import { WeatherIcon } from "./WeatherIcon";
import type { WeatherKind } from "@/lib/mockData";

type Point = { day: string; tempC: number; kind: WeatherKind };

const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 56;
const Y_PADDING = 8;

// Smooth curve through evenly-spaced points using quadratic beziers to each
// pair's midpoint — a simple, dependency-free way to get an organic line
// (rather than a jagged polyline) without pulling in a charting library,
// matching how the rest of this app's visuals (rain bars, weather overlays)
// are all hand-built CSS/SVG.
function buildSmoothPath(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableHeight = GRAPH_HEIGHT - Y_PADDING * 2;

  const points = values.map((v, i) => ({
    x: values.length === 1 ? GRAPH_WIDTH / 2 : (i / (values.length - 1)) * GRAPH_WIDTH,
    y: Y_PADDING + usableHeight - ((v - min) / range) * usableHeight,
  }));

  if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    d += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x} ${last.y}`;
  return d;
}

export function HourlyTempGraph({ points }: { points: Point[] }) {
  const path = buildSmoothPath(points.map((p) => p.tempC));

  return (
    <div className="rounded-lg bg-surface-1 p-5">
      <h2 className="mb-4 text-base font-semibold text-text-primary">Hourly forecast</h2>

      <div className="flex justify-between">
        {points.map((p, i) => (
          <div key={`${p.day}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-sm font-semibold text-text-primary">{p.tempC}°</span>
            <WeatherIcon kind={p.kind} size={18} />
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        preserveAspectRatio="none"
        className="mt-2 h-14 w-full"
      >
        <path d={path} fill="none" stroke="var(--color-accent-primary)" strokeWidth={2} strokeLinecap="round" />
      </svg>

      <div className="mt-1 flex justify-between">
        {points.map((p, i) => (
          <span key={`${p.day}-lbl-${i}`} className="flex-1 text-center text-[11px] text-text-tertiary">
            {p.day}
          </span>
        ))}
      </div>
    </div>
  );
}
