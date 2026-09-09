export type AirQualityResponse = {
  lat: number;
  lon: number;
  us_aqi: number;
  category: string;
  pm2_5: number;
  pm10: number;
  ozone: number;
  carbon_monoxide: number;
  nitrogen_dioxide: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityResponse> {
  const res = await fetch(`${API_URL}/api/air-quality?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`Air quality fetch failed: HTTP ${res.status}`);
  return res.json();
}

const CATEGORY_COLOR: Record<string, string> = {
  Good: "var(--color-success)",
  Moderate: "var(--color-accent-warning)",
  "Unhealthy for Sensitive Groups": "var(--color-accent-warning)",
  Unhealthy: "var(--color-alert)",
  "Very Unhealthy": "var(--color-alert)",
  Hazardous: "var(--color-alert)",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLOR[category] ?? "var(--color-text-secondary)";
}
