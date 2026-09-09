export type GeocodeResult = { name: string; lat: number; lon: number };

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? "";

type MapTilerFeature = {
  place_name: string;
  center: [number, number];
};

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  if (!MAPTILER_KEY || query.trim().length < 2) return [];

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=6&autocomplete=true&language=en`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const features: MapTilerFeature[] = data.features ?? [];
  return features.map((f) => ({
    name: f.place_name,
    lon: f.center[0],
    lat: f.center[1],
  }));
}
