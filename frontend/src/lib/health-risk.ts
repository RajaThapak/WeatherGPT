import type { WeatherResponse } from "./weather-api";
import type { AirQualityResponse } from "./air-quality-api";

export type HealthRisk = {
  label: string;
  message: string;
  severity: "moderate" | "high" | "extreme";
};

// Heat-risk bands on the real apparent_temp_c ("feels like") reading, which
// Open-Meteo already derives from temp/humidity/wind — not a separate
// invented index, just thresholds applied to a real number.
function heatRisk(weather: WeatherResponse): HealthRisk | null {
  const feelsLike = Math.round(weather.apparent_temp_c);
  if (feelsLike >= 45) {
    return {
      label: "Extreme heat",
      message: `Feels like ${feelsLike}°C — avoid outdoor exposure, especially for children and the elderly.`,
      severity: "extreme",
    };
  }
  if (feelsLike >= 40) {
    return {
      label: "High heat",
      message: `Feels like ${feelsLike}°C — limit strenuous outdoor activity and stay hydrated.`,
      severity: "high",
    };
  }
  if (feelsLike >= 35) {
    return {
      label: "Heat caution",
      message: `Feels like ${feelsLike}°C — take breaks in shade and drink water.`,
      severity: "moderate",
    };
  }
  return null;
}

// Reuses the same real AQI + category already computed by the backend
// (app/services/air_quality.py, standard US AQI bands) — just reframes it
// as a health advisory instead of a raw index reading.
function airQualityRisk(aq: AirQualityResponse | null): HealthRisk | null {
  if (!aq) return null;
  if (aq.category === "Unhealthy" || aq.category === "Very Unhealthy" || aq.category === "Hazardous") {
    return {
      label: "Air quality",
      message: `AQI ${aq.us_aqi} (${aq.category}) — limit outdoor exertion; sensitive groups should stay indoors.`,
      severity: aq.category === "Hazardous" ? "extreme" : "high",
    };
  }
  if (aq.category === "Unhealthy for Sensitive Groups") {
    return {
      label: "Air quality",
      message: `AQI ${aq.us_aqi} — children, older adults, and those with respiratory conditions should limit prolonged outdoor exertion.`,
      severity: "moderate",
    };
  }
  return null;
}

// A weather-correlate heads-up, not a disease/epidemiological prediction —
// warm + humid + rain-likely conditions are well-established as favorable
// for mosquito breeding, so this flags the condition, not a health outcome.
function vectorRisk(weather: WeatherResponse): HealthRisk | null {
  const temp = weather.temp_c;
  const humidity = weather.humidity_pct;
  const nearTermRainChance = Math.max(0, ...weather.hourly.slice(0, 6).map((h) => h.precipitation_probability));
  const favorable = temp >= 20 && temp <= 35 && humidity > 60 && nearTermRainChance > 50;
  if (!favorable) return null;
  return {
    label: "Mosquito activity",
    message: "Warm, humid conditions with rain likely — use repellent and clear any standing water nearby.",
    severity: "moderate",
  };
}

// Returns only the risks that actually cross a real threshold right now —
// an empty array (calm day) is a valid, expected result, not a fallback.
export function getHealthRisks(weather: WeatherResponse, aq: AirQualityResponse | null): HealthRisk[] {
  return [heatRisk(weather), airQualityRisk(aq), vectorRisk(weather)].filter(
    (r): r is HealthRisk => r !== null,
  );
}
