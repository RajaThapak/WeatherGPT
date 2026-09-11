export type WeatherKind = "sun" | "cloud" | "cloud-sun" | "rain" | "storm" | "snow";

// Fixed reference points for the decorative idle globe — not weather data,
// never shown as if it were a live reading.
export const globeMarkers: { name: string; location: [number, number]; size: number }[] = [
  { name: "Delhi", location: [28.6139, 77.209], size: 0.05 },
  { name: "Mumbai", location: [19.076, 72.8777], size: 0.05 },
  { name: "Kolkata", location: [22.5726, 88.3639], size: 0.05 },
  { name: "Chennai", location: [13.0827, 80.2707], size: 0.05 },
  { name: "Mathura", location: [27.5045, 77.6737], size: 0.07 },
];
