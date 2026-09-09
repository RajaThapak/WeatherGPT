import { Sun, Cloud, CloudSun, CloudRain, CloudLightning, CloudSnow, type LucideProps } from "lucide-react";
import type { WeatherKind } from "@/lib/mockData";

const ICONS: Record<WeatherKind, typeof Sun> = {
  sun: Sun,
  cloud: Cloud,
  "cloud-sun": CloudSun,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
};

const COLORS: Record<WeatherKind, string> = {
  sun: "#F2B84B",
  cloud: "#A0A0A5",
  "cloud-sun": "#F2B84B",
  rain: "#5B9BD5",
  storm: "#C9B6EA",
  snow: "#DCEEF9",
};

export function WeatherIcon({ kind, ...props }: { kind: WeatherKind } & LucideProps) {
  const Icon = ICONS[kind];
  return <Icon color={COLORS[kind]} strokeWidth={1.75} {...props} />;
}
