"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/lib/location-context";

// Bridges AuthProvider (which lives in layout.tsx, above pages that have no
// location at all — /login, /signup) and LocationProvider (which only wraps
// the dashboard) — keeps the signed-in user's last-known location on the
// backend in sync so the WhatsApp digest/change-watch loop always has
// somewhere current to check, without either provider needing to know about
// the other directly.
export function AccountLocationSync() {
  const { user, syncLocation } = useAuth();
  const { location } = useLocation();

  useEffect(() => {
    if (!user) return;
    syncLocation(location.lat, location.lon, location.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location]);

  return null;
}
