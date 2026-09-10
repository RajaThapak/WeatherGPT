// Placeholder data for the dashboard UI pass — replace with real BE-3 (weather
// aggregator) / BE-10 (climate analytics) responses once those are built.

export type WeatherKind = "sun" | "cloud" | "cloud-sun" | "rain" | "storm" | "snow";

export const heroForecast = {
  day: "Monday",
  time: "11:42 PM",
  tempC: 16,
  kind: "cloud-sun" as WeatherKind,
  realFeelC: 18,
  wind: "NE, 5-8km/h",
  pressure: "1000MB",
  sunrise: "8:02 AM",
  humidity: "51%",
  sunset: "9:18 PM",
};

export const weekForecast: { day: string; tempC: number; kind: WeatherKind }[] = [
  { day: "Tue", tempC: 10, kind: "rain" },
  { day: "Wed", tempC: 15, kind: "cloud-sun" },
  { day: "Thu", tempC: 11, kind: "cloud" },
  { day: "Fri", tempC: 18, kind: "storm" },
  { day: "Sat", tempC: 12, kind: "rain" },
  { day: "Sun", tempC: 10, kind: "cloud" },
];

export const rainChance: { label: string; value: number }[] = [
  { label: "10AM", value: 0.35 },
  { label: "11AM", value: 0.85 },
  { label: "12AM", value: 0.55 },
  { label: "1PM", value: 0.45 },
  { label: "2PM", value: 0.4 },
  { label: "3PM", value: 0.3 },
];

export const globeMarkers: { name: string; location: [number, number]; size: number }[] = [
  { name: "Delhi", location: [28.6139, 77.209], size: 0.05 },
  { name: "Mumbai", location: [19.076, 72.8777], size: 0.05 },
  { name: "Kolkata", location: [22.5726, 88.3639], size: 0.05 },
  { name: "Chennai", location: [13.0827, 80.2707], size: 0.05 },
  { name: "Mathura", location: [27.5045, 77.6737], size: 0.07 },
];
