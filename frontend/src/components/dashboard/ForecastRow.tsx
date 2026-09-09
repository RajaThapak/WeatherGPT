"use client";

import { HeroForecastCard } from "./HeroForecastCard";
import { ForecastDayCard } from "./ForecastDayCard";
import { weekForecast as mockWeek } from "@/lib/mockData";
import { useLocation } from "@/lib/location-context";
import { useView } from "@/lib/view-context";
import { toHeroForecast, toTomorrowHero, toWeekForecast, toTodayHourly, toTomorrowHourly } from "@/lib/weather-api";

export function ForecastRow() {
  const { weather } = useLocation();
  const { activeTab } = useView();

  let heroData;
  let strip: { day: string; tempC: number; kind: (typeof mockWeek)[number]["kind"] }[];

  if (!weather) {
    heroData = undefined;
    strip = mockWeek;
  } else if (activeTab === "Today") {
    heroData = toHeroForecast(weather);
    strip = toTodayHourly(weather);
  } else if (activeTab === "Tomorrow") {
    heroData = toTomorrowHero(weather) ?? toHeroForecast(weather);
    const tomorrowHourly = toTomorrowHourly(weather);
    // Falls back to the old multi-day strip only if there's genuinely no
    // hourly coverage for tomorrow yet (e.g. a still-cached pre-fix
    // response) — normally this now shows tomorrow's own hour-by-hour
    // breakdown, same as Today.
    strip = tomorrowHourly.length > 0 ? tomorrowHourly : toWeekForecast(weather, 2);
  } else {
    heroData = toHeroForecast(weather);
    strip = toWeekForecast(weather, 1);
  }

  return (
    <div className="no-scrollbar flex h-[190px] gap-4 overflow-x-auto">
      <div className="flex h-full flex-[1.5] min-w-[220px]">
        <HeroForecastCard data={heroData} />
      </div>
      {strip.map((day, i) => (
        <ForecastDayCard key={`${day.day}-${i}`} {...day} />
      ))}
    </div>
  );
}
