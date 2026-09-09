export type WeatherKind = "sun" | "cloud" | "cloud-sun" | "rain" | "storm" | "snow";

export type DailyForecast = {
  date: string;
  temp_max_c: number;
  temp_min_c: number;
  kind: WeatherKind;
};

export type HourlyPoint = {
  time: string;
  precipitation_probability: number;
  temp_c: number;
};

export type WeatherResponse = {
  lat: number;
  lon: number;
  current_time: string;
  temp_c: number;
  apparent_temp_c: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  pressure_hpa: number;
  humidity_pct: number;
  kind: WeatherKind;
  sunrise: string;
  sunset: string;
  daily: DailyForecast[];
  hourly: HourlyPoint[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const res = await fetch(`${API_URL}/api/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`Weather fetch failed: HTTP ${res.status}`);
  return res.json();
}

// Open-Meteo's time strings are already local to the queried place
// (timezone=auto) — parse the HH:MM substring directly rather than going
// through `new Date()`, which would silently reinterpret them in the
// browser's own timezone.
function timeLabel(iso: string): string {
  const hourStr = iso.split("T")[1]?.slice(0, 2) ?? "00";
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${period}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

const WIND_COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];
function windCompass(deg: number): string {
  return WIND_COMPASS[Math.round(deg / 22.5) % 16];
}

export type HeroForecastData = {
  day: string;
  time?: string;
  tempC: number;
  tempLowC?: number;
  kind: WeatherKind;
  realFeelC?: number;
  wind?: string;
  pressure?: string;
  sunrise?: string;
  humidity?: string;
  sunset?: string;
};

export function toHeroForecast(w: WeatherResponse): HeroForecastData {
  return {
    day: dayLabel(w.current_time.split("T")[0]),
    time: timeLabel(w.current_time),
    tempC: Math.round(w.temp_c),
    kind: w.kind,
    realFeelC: Math.round(w.apparent_temp_c),
    wind: `${windCompass(w.wind_direction_deg)}, ${Math.round(w.wind_speed_kmh)}km/h`,
    pressure: `${Math.round(w.pressure_hpa)}hPa`,
    sunrise: timeLabel(w.sunrise),
    humidity: `${w.humidity_pct}%`,
    sunset: timeLabel(w.sunset),
  };
}

// Open-Meteo's daily forecast only has min/max temp + condition per future
// day — none of the wind/pressure/humidity/sunrise/sunset detail that
// `current` has, so the Tomorrow hero deliberately renders a lighter view.
export function toTomorrowHero(w: WeatherResponse): HeroForecastData | null {
  const tomorrow = w.daily[1];
  if (!tomorrow) return null;
  return {
    day: "Tomorrow",
    tempC: Math.round(tomorrow.temp_max_c),
    tempLowC: Math.round(tomorrow.temp_min_c),
    kind: tomorrow.kind,
  };
}

export function toWeekForecast(w: WeatherResponse, startIndex = 1) {
  return w.daily.slice(startIndex, startIndex + 6).map((d) => ({
    day: dayLabel(d.date),
    tempC: Math.round(d.temp_max_c),
    kind: d.kind,
  }));
}

// Hourly points don't carry their own weather code from the backend, so the
// day's overall condition icon is reused for each hour — the temperature is
// the part that actually varies hour to hour here.
export function toTodayHourly(w: WeatherResponse) {
  return w.hourly.slice(0, 6).map((h) => ({
    day: timeLabel(h.time),
    tempC: Math.round(h.temp_c),
    kind: w.kind,
  }));
}

// Same hour-by-hour treatment as Today, but for tomorrow's date specifically
// — matched by date prefix since `hourly` now carries a 48h window (see
// backend/app/services/weather.py) rather than just a handful of hours.
export function toTomorrowHourly(w: WeatherResponse) {
  const tomorrowDate = w.daily[1]?.date;
  if (!tomorrowDate) return [];
  const tomorrowKind = w.daily[1]?.kind ?? w.kind;
  return w.hourly
    .filter((h) => h.time.startsWith(tomorrowDate))
    .slice(0, 6)
    .map((h) => ({
      day: timeLabel(h.time),
      tempC: Math.round(h.temp_c),
      kind: tomorrowKind,
    }));
}

export function toRainChance(w: WeatherResponse) {
  return w.hourly.slice(0, 6).map((h) => ({
    label: timeLabel(h.time),
    value: h.precipitation_probability / 100,
  }));
}
