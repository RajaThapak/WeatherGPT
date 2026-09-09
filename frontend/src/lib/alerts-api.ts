export type WeatherAlert = {
  id: string;
  event: string;
  headline: string;
  description: string | null;
  instruction: string | null;
  severity: string;
  urgency: string;
  certainty: string;
  area_desc: string;
  onset: string;
  expires: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchActiveAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  const res = await fetch(`${API_URL}/api/alerts?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`Alerts fetch failed: HTTP ${res.status}`);
  return res.json();
}

export async function postSubscription(
  subscription: PushSubscriptionJSON,
  lat: number,
  lon: number,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/alerts/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      lat,
      lon,
    }),
  });
  if (!res.ok) throw new Error(`Subscribe failed: HTTP ${res.status}`);
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await fetch(`${API_URL}/api/alerts/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {
    // Best-effort — the local unsubscribe state is what matters most.
  });
}

// Converts a base64url VAPID public key (the format the backend hands out)
// into the raw Uint8Array PushManager.subscribe() expects. Built via `new
// Uint8Array(length)` + a loop (not Uint8Array.from) — the DOM lib's
// `applicationServerKey` wants an ArrayBuffer-backed view specifically, and
// newer TS lib versions no longer accept the ArrayBufferLike-backed array
// Uint8Array.from(iterable) produces.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}
