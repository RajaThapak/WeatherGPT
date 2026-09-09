"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "./location-context";
import {
  deleteSubscription,
  fetchActiveAlerts,
  postSubscription,
  urlBase64ToUint8Array,
  type WeatherAlert,
} from "./alerts-api";

const SUBSCRIBED_KEY = "weathergpt:alerts-subscribed";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type AlertsContextValue = {
  subscribed: boolean;
  activeAlerts: WeatherAlert[];
  permissionDenied: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { location } = useLocation();
  const [subscribed, setSubscribed] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<WeatherAlert[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const endpointRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setSubscribed(window.localStorage.getItem(SUBSCRIBED_KEY) === "1");
    } catch {
      // localStorage unavailable — subscription state just won't persist across reloads.
    }
  }, []);

  // Always keep active-alert data current for wherever the user is looking,
  // independent of whether push is enabled — the bell/banner should reflect
  // real alerts even before someone opts in to push.
  useEffect(() => {
    fetchActiveAlerts(location.lat, location.lon)
      .then(setActiveAlerts)
      .catch(() => setActiveAlerts([]));
  }, [location]);

  // If already subscribed, keep the stored subscription's lat/lon in sync
  // with wherever the user is currently looking, so "alerts for current
  // location" stays true rather than freezing at the location they first
  // subscribed from.
  useEffect(() => {
    if (!subscribed) return;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await postSubscription(existing.toJSON(), location.lat, location.lon);
        }
      } catch {
        // Best-effort resync — a stale subscription location isn't worth surfacing an error for.
      }
    })();
  }, [location, subscribed]);

  const subscribe = async () => {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error("Alerts aren't configured yet — no VAPID key set.");
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications aren't supported in this browser.");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    endpointRef.current = sub.endpoint;
    await postSubscription(sub.toJSON(), location.lat, location.lon);

    setSubscribed(true);
    try {
      window.localStorage.setItem(SUBSCRIBED_KEY, "1");
    } catch {
      // Non-fatal — subscription still works this session even if it won't persist.
    }
  };

  const unsubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await deleteSubscription(existing.endpoint);
        await existing.unsubscribe();
      }
    } catch {
      // Best-effort — still clear local state below regardless.
    }
    setSubscribed(false);
    try {
      window.localStorage.removeItem(SUBSCRIBED_KEY);
    } catch {
      // Nothing further to do if storage is unavailable.
    }
  };

  return (
    <AlertsContext.Provider value={{ subscribed, activeAlerts, permissionDenied, subscribe, unsubscribe }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within an AlertsProvider");
  return ctx;
}
