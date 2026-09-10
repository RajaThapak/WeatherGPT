"use client";

import { useEffect, useState } from "react";
import { useLocation } from "./location-context";
import { fetchAirQuality, type AirQualityResponse } from "./air-quality-api";
import { getHealthRisks, type HealthRisk } from "./health-risk";

// Shared by anywhere that needs to show health risks (currently just the
// Navbar's notification dropdown) — keeps the AQI fetch + real-data
// derivation in one place rather than duplicated per consumer.
export function useHealthRisks(): HealthRisk[] {
  const { weather, location } = useLocation();
  const [aq, setAq] = useState<AirQualityResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAirQuality(location.lat, location.lon)
      .then((data) => !cancelled && setAq(data))
      .catch(() => !cancelled && setAq(null));
    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lon]);

  if (!weather) return [];
  return getHealthRisks(weather, aq);
}
