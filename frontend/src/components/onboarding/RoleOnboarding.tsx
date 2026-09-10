"use client";

import { useState } from "react";
import { useRole } from "@/lib/role-context";

const SUGGESTIONS = ["Farmer", "Pilot", "Fisherman", "Delivery rider", "Commuter", "Office / IT"];

export function RoleOnboarding() {
  const { role, hasLoaded, setRole } = useRole();
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (!hasLoaded || role !== null || dismissed) return null;

  const confirm = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRole(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface-1 p-5 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <h2 className="text-base font-semibold text-text-primary">What best describes you?</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          WeatherGPT will frame its answers around what matters to you — a farmer cares about spray
          conditions, a pilot cares about visibility. Type anything, it doesn't have to match a list.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-secondary transition-colors duration-[120ms] hover:bg-accent-primary-soft hover:text-text-primary"
            >
              {s}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm(value)}
          placeholder="e.g. Construction site manager"
          autoFocus
          className="mt-3 h-10 w-full rounded-md bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md px-3 py-2 text-xs text-text-tertiary transition-colors duration-[120ms] hover:bg-surface-2"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => confirm(value)}
            disabled={!value.trim()}
            className="rounded-md bg-accent-primary px-3 py-2 text-xs font-semibold text-text-inverse transition-opacity duration-[120ms] disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
