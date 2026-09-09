// Minimal service worker — only handles Web Push delivery, no offline
// caching/PWA install prompt (not part of this feature's scope).

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title || "Weather alert", {
      body: payload.body || "",
      icon: "/globe.svg",
      data: { severity: payload.severity },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/");
    }),
  );
});
