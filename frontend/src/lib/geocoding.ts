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

// Same MapTiler endpoint, coordinates instead of a text query — turns a
// raw lat/lon (e.g. from the browser's Geolocation API) into a real place
// name, the same way a forward search result already looks.
//
// Restricted to populated-place types (plus broader administrative-area
// fallbacks for sparser/rural coordinates) — without this, MapTiler picks
// whatever indexed feature is geometrically closest to the raw
// coordinates, which on or near a highway is often the road itself (e.g.
// "NH44, Uttar Pradesh") or a bare street address, not the town, city, or
// district you're actually near. A narrower list restricted to just
// municipality/locality/place/neighbourhood was tested and, in sparser
// areas, sometimes matched nothing at all — county/subregion/
// municipal_district are included so a real (if broader) name is still
// found rather than the request coming back empty.
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult | null> {
  if (!MAPTILER_KEY) return null;

  const types = "municipality,locality,place,neighbourhood,municipal_district,county,subregion";
  const url = `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${MAPTILER_KEY}&limit=1&language=en&types=${types}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const feature: MapTilerFeature | undefined = (data.features ?? [])[0];
  if (!feature) return null;

  return { name: feature.place_name, lon: feature.center[0], lat: feature.center[1] };
}
