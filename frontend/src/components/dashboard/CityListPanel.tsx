"use client";

import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { WeatherIcon } from "./WeatherIcon";
import { otherCities } from "@/lib/mockData";

const PREVIEW_COUNT = 3;

export function CityListPanel() {
  const [expanded, setExpanded] = useState(false);
  const visibleCities = expanded ? otherCities : otherCities.slice(0, PREVIEW_COUNT);

  return (
    <div>
      <SectionHeader
        title="Other large cities"
        action={{
          label: expanded ? "Show less" : "Show All",
          variant: "link",
          onClick: () => setExpanded((v) => !v),
        }}
      />

      <div className="flex flex-col gap-3">
        {visibleCities.map((c) => (
          <div
            key={c.city}
            className="flex items-center gap-3 rounded-lg bg-surface-1 p-4 transition-colors duration-[120ms] hover:bg-surface-2"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-2">
              <WeatherIcon kind={c.kind} size={22} />
            </div>

            <div className="flex flex-1 flex-col">
              <span className="text-[11px] tracking-[0.02em] text-text-tertiary">{c.country}</span>
              <span className="text-base font-semibold text-text-primary">{c.city}</span>
              <span className="text-[13px] text-text-secondary">{c.condition}</span>
            </div>

            <span className="text-xl font-semibold text-text-primary">{c.tempC}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}
