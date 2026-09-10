"use client";

import { Bell, X } from "lucide-react";
import { useAlerts } from "@/lib/alerts-context";
import { formatRelativeTime } from "@/lib/chat-storage";

// The full-screen "something serious just happened" moment: only fires for
// Extreme/Severe alerts (see alerts-context.tsx), auto-shown once per new
// alert and re-showable by clicking the push notification for it. z-[100]
// deliberately outranks everything else in the app, including the chat
// overlay (z-50) and docked sidebar, so it truly takes over the screen.
export function AlertTakeover() {
  const { takeoverAlert, dismissTakeover } = useAlerts();
  if (!takeoverAlert) return null;
  const a = takeoverAlert;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-surface-1 p-6 text-center shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={dismissTakeover}
          aria-label="Close"
          className="absolute right-3 top-3 text-text-tertiary transition-colors duration-[120ms] hover:text-text-primary"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full bg-alert blur-2xl [animation:alert-glow_1.6s_ease-in-out_infinite]" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-alert text-text-inverse">
            <Bell size={24} strokeWidth={2} className="[animation:bell-ring_1.6s_ease-in-out_infinite]" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-alert">{a.severity} Alert</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">{a.headline}</h2>
          <p className="mt-1 text-sm text-text-secondary">{a.area_desc}</p>
        </div>

        {a.description && <p className="text-sm text-text-secondary">{a.description}</p>}
        {a.instruction && (
          <p className="rounded-lg bg-alert/15 px-3 py-2 text-sm text-alert">{a.instruction}</p>
        )}

        <p className="text-[11px] text-text-tertiary opacity-70">
          Source: IMD CAP feed · issued {formatRelativeTime(new Date(a.sent).getTime())}
        </p>

        <button
          type="button"
          onClick={dismissTakeover}
          className="mt-1 w-full rounded-md bg-accent-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition-opacity duration-[120ms] hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
