"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "./location-context";
import { useRole } from "./role-context";
import {
  deleteSubscription,
  fetchActiveAlerts,
  postSubscription,
  urlBase64ToUint8Array,
  type WeatherAlert,
} from "./alerts-api";

const SUBSCRIBED_KEY = "weathergpt:alerts-subscribed";
// Separate from AlertBanner's own "dismissed" tracking — that one hides the
// banner permanently, this one only tracks whether the full-screen takeover
// has already auto-fired once for a given alert id, so it doesn't replay on
// every reload. Clicking the push notification bypasses this entirely (see
// the service-worker message / URL-param handling below), which is the
// "show it again" path.
const TAKEOVER_SEEN_KEY = "weathergpt:takeover-seen-alerts";
const HIGH_SEVERITY = new Set(["Extreme", "Severe"]);
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function loadSeenTakeovers(): Set<string> {
  try {
    const raw = window.localStorage.getItem(TAKEOVER_SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

type AlertsContextValue = {
  subscribed: boolean;
  activeAlerts: WeatherAlert[];
  permissionDenied: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  takeoverAlert: WeatherAlert | null;
  dismissTakeover: () => void;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { location } = useLocation();
  const { role } = useRole();
  const [subscribed, setSubscribed] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<WeatherAlert[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [takeoverAlert, setTakeoverAlert] = useState<WeatherAlert | null>(null);
  const endpointRef = useRef<string | null>(null);
  const seenTakeoversRef = useRef<Set<string> | null>(null);
  // An alert id requested via a push-notification click (message or URL
  // param) that arrived before `activeAlerts` had loaded — checked again
  // once the fetch below resolves, instead of being silently missed.
  const pendingAlertIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setSubscribed(window.localStorage.getItem(SUBSCRIBED_KEY) === "1");
    } catch {
      // localStorage unavailable — subscription state just won't persist across reloads.
    }
    seenTakeoversRef.current = loadSeenTakeovers();
  }, []);

  const markTakeoverSeen = (id: string) => {
    const seen = seenTakeoversRef.current ?? new Set<string>();
    seen.add(id);
    seenTakeoversRef.current = seen;
    try {
      window.localStorage.setItem(TAKEOVER_SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // Non-fatal — it may just auto-fire again next reload if storage is unavailable.
    }
  };

  // Always keep active-alert data current for wherever the user is looking,
  // independent of whether push is enabled — the bell/banner should reflect
  // real alerts even before someone opts in to push.
  useEffect(() => {
    fetchActiveAlerts(location.lat, location.lon)
      .then((alerts) => {
        setActiveAlerts(alerts);

        // A pending open-request (from a notification click) that arrived
        // before this fetch resolved — honor it now that the alert it
        // pointed to may actually be in the list, regardless of "seen".
        if (pendingAlertIdRef.current) {
          const pending = alerts.find((a) => a.id === pendingAlertIdRef.current);
          if (pending) {
            setTakeoverAlert(pending);
            pendingAlertIdRef.current = null;
            return;
          }
        }

        // Otherwise, auto-fire the takeover the first time a new
        // Extreme/Severe alert shows up — not on every reload of one
        // already seen.
        const seen = seenTakeoversRef.current ?? new Set<string>();
        const fresh = alerts.find((a) => HIGH_SEVERITY.has(a.severity) && !seen.has(a.id));
        if (fresh) {
          setTakeoverAlert(fresh);
          markTakeoverSeen(fresh.id);
        }
      })
      .catch(() => setActiveAlerts([]));
  }, [location]);

  // Two ways to (re-)open the takeover regardless of "seen" state: clicking
  // a push notification while a tab is already open (service worker sends a
  // postMessage), or clicking one that had to open a fresh tab (encoded as
  // a ?alert= URL param instead, since there's no live page to message yet).
  // Either can arrive before `activeAlerts` has loaded, so both just record
  // the request — the fetch effect above is what actually resolves it,
  // immediately if the alert's already loaded, or once it lands otherwise.
  useEffect(() => {
    const requestOpen = (id: string) => {
      const match = activeAlerts.find((a) => a.id === id);
      if (match) setTakeoverAlert(match);
      else pendingAlertIdRef.current = id;
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-alert" && event.data.alertId) {
        requestOpen(event.data.alertId);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("alert");
    if (fromUrl) {
      requestOpen(fromUrl);
      params.delete("alert");
      const cleaned = params.toString();
      window.history.replaceState(null, "", cleaned ? `?${cleaned}` : window.location.pathname);
    }

    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissTakeover = () => setTakeoverAlert(null);

  // If already subscribed, keep the stored subscription's lat/lon and role
  // in sync with the user's current location/role, so "alerts for current
  // location" stays true and push notifications keep matching whoever they
  // say they are now, rather than freezing at whatever was true at signup.
  useEffect(() => {
    if (!subscribed) return;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await postSubscription(existing.toJSON(), location.lat, location.lon, role);
        }
      } catch {
        // Best-effort resync — a stale subscription location isn't worth surfacing an error for.
      }
    })();
  }, [location, role, subscribed]);

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
    await postSubscription(sub.toJSON(), location.lat, location.lon, role);

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
    <AlertsContext.Provider
      value={{
        subscribed,
        activeAlerts,
        permissionDenied,
        subscribe,
        unsubscribe,
        takeoverAlert,
        dismissTakeover,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within an AlertsProvider");
  return ctx;
}
