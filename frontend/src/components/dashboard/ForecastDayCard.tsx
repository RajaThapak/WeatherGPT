import { WeatherIcon } from "./WeatherIcon";
import type { WeatherKind } from "@/lib/mockData";

export function ForecastDayCard({ day, tempC, kind }: { day: string; tempC: number; kind: WeatherKind }) {
  return (
    <div className="flex h-full min-w-[76px] flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-surface-1 px-3 py-4">
      <span className="text-[13px] font-medium text-text-secondary">{day}</span>
      <WeatherIcon kind={kind} size={30} />
      <span className="text-2xl font-semibold text-text-primary">{tempC}°</span>
    </div>
  );
}
