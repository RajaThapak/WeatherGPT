// Minimal service worker — only handles Web Push delivery, no offline
// caching/PWA install prompt (not part of this feature's scope).

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title || "Weather alert", {
      body: payload.body || "",
      icon: "/globe.svg",
      data: { severity: payload.severity, alertId: payload.alertId },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alertId = event.notification.data?.alertId;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        const client = clients[0];
        // Tell the already-open tab which alert to re-show as the
        // full-screen takeover — clicking the notification should bring the
        // same attention-grabbing moment back, not just quietly focus the tab.
        if (alertId) client.postMessage({ type: "open-alert", alertId });
        return client.focus();
      }
      // No tab open yet — encode it in the URL so the app can pick it up
      // once it loads (see alerts-context.tsx's mount-time check).
      const url = alertId ? `/?alert=${encodeURIComponent(alertId)}` : "/";
      return self.clients.openWindow(url);
    }),
  );
});
