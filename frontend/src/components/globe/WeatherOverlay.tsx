"use client";

import type { WeatherKind } from "@/lib/weather-api";

// Subtle looping ambient effect over the settled map, matching the searched
// place's real current weather (location-context.tsx already fetches this
// for the active location, so no extra fetch here) — pure CSS, no images,
// no WebGL, pointer-events-none throughout so it never blocks map
// interaction. Only ever shown once the globe/cloud transition has finished
// (see GlobePanel.tsx), so it never competes with those.

// Deterministic pseudo-random spread (not Math.random()) so every droplet's
// position/speed/delay is fixed across renders — keeps the effect stable
// rather than reshuffling on every re-render.
function makeDroplets(count: number, minDuration: number, maxDuration: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(i * 6.7 + (i % 3) * 11) % 100}%`,
    height: 28 + ((i * 13) % 30),
    duration: minDuration + (((i * 977) % 1000) / 1000) * (maxDuration - minDuration),
    delay: -(((i * 613) % 4000) / 1000),
  }));
}

const STORM_DROPLETS = makeDroplets(26, 1.3, 2.1);

// "Rain" reads as condensation on glass, not streaking rain (that's storm's
// job): a dense field of small static droplets clinging to the pane, plus a
// handful of larger ones slowly sliding down.
function makeCondensationDots(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const leftSeed = (i * 53 + 7) % 971;
    const topSeed = (i * 131 + 17) % 977;
    return {
      left: `${leftSeed % 100}%`,
      top: `${topSeed % 100}%`,
      size: 2 + ((i * 29) % 10), // 2-11px, skewed toward small
    };
  });
}

function makeCondensationSliders(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(i * 8.3 + (i % 4) * 9) % 100}%`,
    size: 9 + ((i * 17) % 9), // 9-17px
    duration: 3.2 + (((i * 977) % 1000) / 1000) * 2.5,
    delay: -(((i * 613) % 5000) / 1000),
  }));
}

const CONDENSATION_DOTS = makeCondensationDots(80);
const CONDENSATION_SLIDERS = makeCondensationSliders(12);

const SNOWFLAKES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  size: 3 + (i % 4),
  duration: 6 + (i % 5),
  delay: -(((i * 733) % 6000) / 1000),
}));

const CLOUD_PUFFS = [
  { top: "6%", size: 220, duration: 46, delay: 0 },
  { top: "26%", size: 160, duration: 60, delay: -20 },
  { top: "14%", size: 190, duration: 52, delay: -35 },
];

export function WeatherOverlay({ kind }: { kind: WeatherKind }) {
  if (kind === "rain") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
        {CONDENSATION_DOTS.map((d, i) => (
          <div
            key={`dot-${i}`}
            className="condensation-dot"
            style={{ left: d.left, top: d.top, width: d.size, height: d.size }}
          />
        ))}
        {CONDENSATION_SLIDERS.map((d, i) => (
          <div
            key={`slider-${i}`}
            className="condensation-slider"
            style={{
              left: d.left,
              width: d.size,
              height: d.size,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (kind === "storm") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
        {STORM_DROPLETS.map((d, i) => (
          <div
            key={i}
            className="rain-droplet"
            style={{
              left: d.left,
              height: d.height,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-white [animation:storm-flash_5s_ease-out_infinite]" />
      </div>
    );
  }

  if (kind === "snow") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
        {SNOWFLAKES.map((f, i) => (
          <div
            key={i}
            className="absolute top-0 rounded-full bg-white [animation-name:snow-fall] [animation-timing-function:linear] [animation-iteration-count:infinite]"
            style={{
              left: f.left,
              width: f.size,
              height: f.size,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (kind === "cloud" || kind === "cloud-sun") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
        {CLOUD_PUFFS.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full [animation-name:cloud-drift] [animation-timing-function:linear] [animation-iteration-count:infinite]"
            style={{
              top: p.top,
              left: 0,
              width: p.size,
              height: p.size * 0.55,
              background: "radial-gradient(circle, rgba(255,255,255,0.22), rgba(255,255,255,0) 70%)",
              filter: "blur(8px)",
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // sun (clear) — a soft warm glow, gently breathing.
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[12] overflow-hidden [animation:sun-glow_6s_ease-in-out_infinite]"
      style={{
        background: "radial-gradient(circle at 22% 20%, rgba(255,214,140,0.35), rgba(255,214,140,0) 45%)",
      }}
    />
  );
}
