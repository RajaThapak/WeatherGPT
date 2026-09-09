"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAlerts } from "@/lib/alerts-context";

const DISMISSED_KEY = "weathergpt:dismissed-alerts";
const HIGH_SEVERITY = new Set(["Extreme", "Severe"]);

function loadDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function AlertBanner() {
  const { activeAlerts } = useAlerts();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const visible = activeAlerts.filter((a) => HIGH_SEVERITY.has(a.severity) && !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
      // Non-fatal — it'll just reappear on next reload if storage isn't available.
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2.5 rounded-lg bg-alert/15 px-3.5 py-2.5 text-sm text-alert"
        >
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">{a.headline}</span>
            <span className="ml-1.5 text-xs opacity-80">{a.area_desc}</span>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            aria-label="Dismiss alert"
            className="shrink-0 opacity-70 transition-opacity duration-[120ms] hover:opacity-100"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </div>
  );
}
