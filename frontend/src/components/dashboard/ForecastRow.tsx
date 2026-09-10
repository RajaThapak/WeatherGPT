"use client";

import { HeroForecastCard } from "./HeroForecastCard";
import { ForecastDayCard } from "./ForecastDayCard";
import { HourlyTempGraph } from "./HourlyTempGraph";
import { weekForecast as mockWeek } from "@/lib/mockData";
import { useLocation } from "@/lib/location-context";
import { useView } from "@/lib/view-context";
import { toHeroForecast, toTomorrowHero, toWeekForecast, toTodayHourly, toTomorrowHourly } from "@/lib/weather-api";
import { formatRelativeTime } from "@/lib/chat-storage";

export function ForecastRow() {
  const { weather } = useLocation();
  const { activeTab } = useView();

  let heroData;
  let strip: { day: string; tempC: number; kind: (typeof mockWeek)[number]["kind"] }[];
  // True for the two hour-by-hour tabs (Today/Tomorrow) — the line graph
  // only makes sense for an hourly trend, not the 7-day daily strip.
  let isHourly = false;

  if (!weather) {
    heroData = undefined;
    strip = mockWeek;
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
        {strip.map((day, i) => (
          <ForecastDayCard key={`${day.day}-${i}`} {...day} />
        ))}
      </div>

      {/* Mobile, hourly tabs only: hero card full-width, then the hourly
          trend line below it instead of a side-scrolling row of boxes. */}
      {isHourly && (
        <div className="flex flex-col gap-4 lg:hidden">
          <div className="h-[190px]">
            <HeroForecastCard data={heroData} />
          </div>
          <HourlyTempGraph points={strip} />
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
