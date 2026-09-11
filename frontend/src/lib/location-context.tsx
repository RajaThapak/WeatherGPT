"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchWeather, type WeatherResponse } from "./weather-api";
import { reverseGeocode } from "./geocoding";

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

// Promise wrapper around the callback-based Geolocation API. `maximumAge`
// lets the browser hand back a recent cached fix instead of always forcing
// a fresh GPS lock, so repeat app opens resolve fast; `timeout` keeps a
// slow/stuck request from hanging the location resolution indefinitely.
function getLiveLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 5 * 60 * 1000,
    });
  });
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

  // Resolves the starting location on every load, in priority order:
  // 1. Live browser geolocation, reverse-geocoded to a real place name —
  //    the whole point of this feature, tried first on every app open (not
  //    just the first visit), so opening the app in Odisha shows Odisha.
  // 2. The last location saved to localStorage, if geolocation is denied,
  //    unavailable, or times out — this is what used to be the *primary*
  //    restore path (and is what originally fixed a "location resets on
  //    reload" bug) and still is whenever live location can't be resolved.
  // 3. The hardcoded default passed in, as the final fallback.
  // Deliberately done in an effect (not a lazy useState initializer) so the
  // very first render always matches the server-rendered default, avoiding
  // a hydration mismatch — the swap to the resolved location happens right
  // after, mirroring theme-context.tsx's own restore pattern.
  useEffect(() => {
    let cancelled = false;

    const fromStorage = (): LocationState | null => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (isLocationState(parsed)) return parsed;
        }
      } catch {
        // localStorage unavailable — fall through.
      }
      return null;
    };

    const settle = (loc: LocationState) => {
      if (cancelled) return;
      setLocationState(loc);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
      } catch {
        // Non-fatal — just means the next load's storage fallback won't have this.
      }
      fetchFor(loc);
    };

    (async () => {
      try {
        const position = await getLiveLocation();
        if (cancelled) return;
        const { latitude: lat, longitude: lon } = position.coords;
        const place = await reverseGeocode(lat, lon).catch(() => null);
        // Weather uses the real GPS coordinates (not the geocoded feature's
        // own center point, which can be a whole city away) — the reverse
        // lookup is only used for a human-readable name.
        settle({ lat, lon, name: place?.name ?? "Current location" });
      } catch (err) {
        // Denied, unsupported, or timed out — fall back to last-saved,
        // then the hardcoded default, exactly like before this feature.
        // Logged (not swallowed) so a real failure is diagnosable instead
        // of silently looking like "geolocation just didn't run".
        const geoErr = err as GeolocationPositionError | Error;
        const reason =
          "code" in geoErr
            ? { 1: "permission denied", 2: "position unavailable", 3: "timed out" }[geoErr.code] ?? `code ${geoErr.code}`
            : geoErr.message;
        console.warn(`[location] live geolocation failed (${reason}) — falling back.`, geoErr);
        settle(fromStorage() ?? initialLocation);
      }
    })();

    return () => {
      cancelled = true;
    };
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
