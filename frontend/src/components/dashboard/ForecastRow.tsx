"use client";

import { HeroForecastCard } from "./HeroForecastCard";
import { ForecastDayCard } from "./ForecastDayCard";
import { HourlyTempGraph } from "./HourlyTempGraph";
import { useLocation } from "@/lib/location-context";
import { useView } from "@/lib/view-context";
import { toHeroForecast, toTomorrowHero, toWeekForecast, toTodayHourly, toTomorrowHourly } from "@/lib/weather-api";
import { formatRelativeTime } from "@/lib/chat-storage";
import type { WeatherKind } from "@/lib/mockData";

// Matches HourlyTempGraph's shape (temp+icon row, line, day labels) so the
// mobile loading state doesn't jump to a differently-proportioned layout
// once real data arrives.
function HourlyTempGraphSkeleton() {
  return (
    <div className="animate-pulse rounded-lg bg-surface-1 p-5">
      <div className="mb-4 h-4 w-28 rounded bg-surface-3" />
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="h-4 w-6 rounded bg-surface-3" />
            <div className="h-4 w-4 rounded-full bg-surface-3" />
          </div>
        ))}
      </div>
      <div className="mt-2 h-14 w-full rounded bg-surface-2" />
      <div className="mt-1 flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-2.5 w-8 flex-1 rounded bg-surface-3" />
        ))}
      </div>
    </div>
  );
}

export function ForecastRow() {
  const { weather } = useLocation();
  const { activeTab } = useView();

  let heroData;
  let strip: { day: string; tempC: number; kind: WeatherKind }[] = [];
  // True for the two hour-by-hour tabs (Today/Tomorrow) — the line graph
  // only makes sense for an hourly trend, not the 7-day daily strip. While
  // still loading, predict this from the active tab alone (the same value
  // it'll settle on once data arrives) — otherwise the loading skeleton
  // defaults to the desktop horizontal-row shape even on mobile, which
  // isn't the layout Today/Tomorrow actually use there.
  let isHourly = activeTab !== "Next 7 days";

  if (!weather) {
    heroData = undefined;
  } else if (activeTab === "Today") {
    heroData = toHeroForecast(weather);
    strip = toTodayHourly(weather);
    isHourly = true;
  } else if (activeTab === "Tomorrow") {
    heroData = toTomorrowHero(weather) ?? toHeroForecast(weather);
    const tomorrowHourly = toTomorrowHourly(weather);
    // Falls back to the old multi-day strip only if there's genuinely no
    // hourly coverage for tomorrow yet (e.g. a still-cached pre-fix
    // response) — normally this now shows tomorrow's own hour-by-hour
    // breakdown, same as Today.
    strip = tomorrowHourly.length > 0 ? tomorrowHourly : toWeekForecast(weather, 2);
    isHourly = tomorrowHourly.length > 0;
  } else {
    heroData = toHeroForecast(weather);
    strip = toWeekForecast(weather, 1);
  }

  return (
    <>
      {/* Desktop (and the non-hourly 7-day tab, at any width): the existing
          horizontal-scroll strip of boxed cards. */}
      <div
        className={`no-scrollbar h-[190px] gap-4 overflow-x-auto ${isHourly ? "hidden lg:flex" : "flex"}`}
      >
        <div className="flex h-full flex-[1.5] min-w-[220px]">
          <HeroForecastCard data={heroData} />
        </div>
        {!weather
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-full min-w-[76px] flex-1 animate-pulse rounded-lg bg-surface-2" />
            ))
          : strip.map((day, i) => <ForecastDayCard key={`${day.day}-${i}`} {...day} />)}
      </div>

      {/* Mobile, hourly tabs only: hero card full-width, then the hourly
          trend line below it instead of a side-scrolling row of boxes. */}
      {isHourly && (
        <div className="flex flex-col gap-4 lg:hidden">
          <div className="h-[190px]">
            <HeroForecastCard data={heroData} />
          </div>
          {!weather ? <HourlyTempGraphSkeleton /> : <HourlyTempGraph points={strip} />}
        </div>
      )}

      {weather && (
        <p className="text-[11px] text-text-tertiary opacity-70">
          Source: Open-Meteo · updated {formatRelativeTime(new Date(weather.current_time).getTime())}
        </p>
      )}
    </>
  );
}
