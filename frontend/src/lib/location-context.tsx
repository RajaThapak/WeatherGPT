"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchWeather, type WeatherResponse } from "./weather-api";

export type LocationState = { lat: number; lon: number; name: string };

type LocationContextValue = {
  location: LocationState;
  weather: WeatherResponse | null;
  isLoading: boolean;
  error: string | null;
  setLocation: (next: LocationState, precomputedWeather?: WeatherResponse) => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);
const STORAGE_KEY = "weathergpt:last-location";

function isLocationState(value: unknown): value is LocationState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.lat === "number" && typeof v.lon === "number" && typeof v.name === "string";
}

function sameLocation(a: LocationState, b: LocationState): boolean {
  return a.lat === b.lat && a.lon === b.lon && a.name === b.name;
}

export function LocationProvider({
  initialLocation,
  children,
}: {
  initialLocation: LocationState;
  children: ReactNode;
}) {
  const [location, setLocationState] = useState<LocationState>(initialLocation);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchFor = useCallback(async (loc: LocationState) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(loc.lat, loc.lon);
      if (requestId === requestIdRef.current) {
        setWeather(data);
        setIsLoading(false);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    }
  }, []);

  // Restore the last-viewed location (if any) on mount — deliberately done in
  // an effect (not a lazy useState initializer) so the very first render
  // always matches the server-rendered default, avoiding a hydration
  // mismatch; the swap to the persisted location happens right after,
  // mirroring theme-context.tsx's own restore pattern. This is what keeps
  // the map from snapping back to the hardcoded default location whenever
  // something causes the page to remount/reload (whatever the trigger).
  useEffect(() => {
    let restored = initialLocation;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isLocationState(parsed)) restored = parsed;
      }
    } catch {
      // localStorage unavailable — just use the default passed in.
    }
    setLocationState(restored);
    fetchFor(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocation = useCallback(
    (next: LocationState, precomputedWeather?: WeatherResponse) => {
      // Keeps the same object reference when the location hasn't actually
      // changed (e.g. chat.py resolves and re-sends the current location on
      // every message, not just ones that name a place) — GlobePanel's
      // fly-to/globe-reveal animation is keyed off this reference changing,
      // so bailing out here is what stops it replaying on every chat message.
      setLocationState((prev) => (sameLocation(prev, next) ? prev : next));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Non-fatal — location just won't persist across reloads if storage is unavailable.
      }
      if (precomputedWeather) {
        requestIdRef.current += 1; // invalidate any in-flight fetch for the old location
        setWeather(precomputedWeather);
        setIsLoading(false);
        setError(null);
      } else {
        fetchFor(next);
      }
    },
    [fetchFor],
  );

  return (
    <LocationContext.Provider value={{ location, weather, isLoading, error, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within a LocationProvider");
  return ctx;
}
