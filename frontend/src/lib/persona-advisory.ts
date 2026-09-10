import type { WeatherResponse } from "./weather-api";

// Same keyword-bucket approach as the backend's role-aware push tailoring
// (backend/app/services/alerts.py) — a free-text role gets matched into a
// known bucket by substring, or treated as unrecognized. Kept as a separate
// implementation (not shared code) since one runs in Python against alert
// event types and this one runs in TS against live weather metrics; the
// bucket *names* are deliberately kept in sync between the two so the story
// (chat framing / push notifications / this card) is consistent per role.
const ROLE_KEYWORDS: Record<string, string[]> = {
  farmer: ["farm"],
  pilot: ["pilot", "fly", "aviat"],
  fisherman: ["fish", "sail", "boat", "marine"],
  commuter: ["commut", "bike", "cycl", "walk", "rider", "deliver"],
  construction: ["construct", "site", "outdoor", "labour", "labor"],
};

function roleBucket(role: string | null): string | null {
  if (!role) return null;
  const lowered = role.toLowerCase();
  for (const [bucket, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some((kw) => lowered.includes(kw))) return bucket;
  }
  return null;
}

// Highest rain-probability reading across the next few hours, not just the
// current instant — what actually matters for "should I do X soon".
function nearTermRainChance(weather: WeatherResponse): number {
  return Math.max(0, ...weather.hourly.slice(0, 6).map((h) => h.precipitation_probability));
}

// Returns a short, actionable line grounded only in real fetched weather
// fields (wind/rain/humidity/temp/condition — never invented), or null when
// the role isn't recognized. Threshold-based on purpose: explainable and
// honest about what it is (a few simple rules), not a model dressed up to
// look smarter than it is.
export function getPersonaAdvisory(weather: WeatherResponse, role: string | null): string | null {
  const bucket = roleBucket(role);
  if (!bucket) return null;

  const wind = Math.round(weather.wind_speed_kmh);
  const rainChance = Math.round(nearTermRainChance(weather));
  const humidity = weather.humidity_pct;
  const temp = Math.round(weather.temp_c);
  const isStorm = weather.kind === "storm";

  switch (bucket) {
    case "farmer":
      if (wind > 15) return `Wind is ${wind}km/h — hold off spraying until it drops below 15km/h.`;
      if (rainChance > 60) return `${rainChance}% chance of rain in the next few hours — not a good window for spraying.`;
      if (humidity > 85) return `Humidity is ${humidity}% — watch for fungal/blight risk on crops.`;
      return "Conditions look fine for fieldwork today.";
    case "pilot":
      if (isStorm) return "Thunderstorm activity in the area — check NOTAMs before flying.";
      if (wind > 30) return `Wind at ${wind}km/h — expect turbulence/crosswind challenges.`;
      return "No major wind or storm activity — conditions look flyable.";
    case "fisherman":
      if (isStorm) return "Storm activity nearby — avoid going out to sea.";
      if (wind > 25) return `Wind at ${wind}km/h — sea conditions may be rough (wind-based estimate, no live wave data).`;
      return "Wind looks calm for being on the water (based on wind only, not live wave data).";
    case "commuter":
      if (rainChance > 60) return `${rainChance}% chance of rain during commute hours — carry rain gear.`;
      if (wind > 25) return `Windy conditions (${wind}km/h) — be cautious on a bike.`;
      return "Good conditions for commuting.";
    case "construction":
      if (temp > 38) return `High heat (${temp}°C) — schedule strenuous work for cooler hours, stay hydrated.`;
      if (rainChance > 60) return `${rainChance}% chance of rain — plan for delays on exterior work.`;
      if (wind > 30) return `High wind (${wind}km/h) — secure loose materials/scaffolding.`;
      return "Conditions look manageable for outdoor work.";
    default:
      return null;
  }
}
