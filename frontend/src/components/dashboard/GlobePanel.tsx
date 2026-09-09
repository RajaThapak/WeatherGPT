"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Layers, Plus, Minus, Navigation } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useLocation } from "@/lib/location-context";
import { DecorativeGlobe } from "@/components/globe/DecorativeGlobe";
import { CloudWipe } from "@/components/globe/CloudWipe";
import { WeatherOverlay } from "@/components/globe/WeatherOverlay";
import type { MapHandle } from "@/components/globe/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/globe/LeafletMap"), { ssr: false });

// Transition timing for a search-triggered location change:
// 1. Globe spins, fully covering the map, while the map repositions hidden
//    underneath (see the effect below).
// 2. At GLOBE_HOLD_MS, the globe starts fading away AND a cloud bank rolls
//    in on top of it (z-index above the globe) — the map is never visibly
//    uncovered during this handoff.
// 3. After CLOUD_COVER_MS more, the clouds part and dissipate, revealing
//    the map, which has been sitting fully settled underneath the whole
//    time — no other animation is competing with the clouds at this point.
const GLOBE_HOLD_MS = 700;
const CLOUD_COVER_MS = 300;

function FloatingIconButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-secondary shadow-[0_12px_24px_rgba(0,0,0,0.20)] transition-colors duration-[120ms] hover:bg-surface-3 active:scale-[0.97]"
    >
      {children}
    </button>
  );
}

export function GlobePanel() {
  const handleRef = useRef<MapHandle | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [phase, setPhase] = useState<"globe" | "map">("globe");
  const [cloudsActive, setCloudsActive] = useState(false);
  const { location, weather } = useLocation();

  // Single source of truth: fly the map whenever the shared location
  // changes, no matter what changed it — the navbar's search box, or a
  // place resolved from a chat message elsewhere on the page. Every change
  // also replays the globe -> clouds -> map transition described above.
  useEffect(() => {
    if (!isReady) return;
    setPhase("globe");
    setCloudsActive(false);
    handleRef.current?.flyTo(location.lat, location.lon, location.name);

    const t1 = setTimeout(() => {
      setPhase("map"); // globe starts fading
      setCloudsActive(true); // clouds roll in on top of it
    }, GLOBE_HOLD_MS);
    const t2 = setTimeout(() => {
      setCloudsActive(false); // clouds part/dissipate, revealing the settled map
    }, GLOBE_HOLD_MS + CLOUD_COVER_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location, isReady]);

  return (
    <div>
      <SectionHeader title="Global map" action={{ label: "View wide", variant: "pill" }} />

      <div className="relative h-[260px] overflow-hidden rounded-lg bg-black sm:h-[320px] lg:h-[360px]">
        <LeafletMap
          onReady={(handle) => {
            handleRef.current = handle;
            setIsReady(true);
          }}
        />

        <DecorativeGlobe transitioning={phase === "map"} />
        <CloudWipe active={cloudsActive} />
        {phase === "map" && !cloudsActive && weather && <WeatherOverlay kind={weather.kind} />}

        <div className="absolute left-4 top-4 z-20">
          <FloatingIconButton ariaLabel="Reset view" onClick={() => handleRef.current?.reset()}>
            <RotateCcw size={16} strokeWidth={1.5} />
          </FloatingIconButton>
        </div>

        <div className="absolute right-4 top-4 z-20">
          <FloatingIconButton ariaLabel="Toggle layers" onClick={() => handleRef.current?.toggleLayer()}>
            <Layers size={16} strokeWidth={1.5} />
          </FloatingIconButton>
        </div>

        <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          <FloatingIconButton ariaLabel="Zoom in" onClick={() => handleRef.current?.zoomIn()}>
            <Plus size={16} strokeWidth={1.5} />
          </FloatingIconButton>
          <FloatingIconButton ariaLabel="Zoom out" onClick={() => handleRef.current?.zoomOut()}>
            <Minus size={16} strokeWidth={1.5} />
          </FloatingIconButton>
        </div>

        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-3 pr-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.20)]">
          <span className="max-w-[160px] truncate text-xs font-medium text-text-secondary">{location.name}</span>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text-secondary">
            <Navigation size={12} strokeWidth={1.75} />
          </div>
        </div>
      </div>
    </div>
  );
}
