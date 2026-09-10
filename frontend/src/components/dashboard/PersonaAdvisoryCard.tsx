"use client";

import { Sparkles } from "lucide-react";
import { useLocation } from "@/lib/location-context";
import { useRole } from "@/lib/role-context";
import { getPersonaAdvisory } from "@/lib/persona-advisory";

// Renders nothing when there's no role set or the role doesn't match a
// recognized bucket — never shows a generic filler tip just to fill the
// space, matching the "only say what's actually grounded" principle used
// throughout this app's alerts/chat.
export function PersonaAdvisoryCard() {
  const { weather } = useLocation();
  const { role } = useRole();

  if (!weather || !role) return null;
  const advisory = getPersonaAdvisory(weather, role);
  if (!advisory) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-1 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary text-text-inverse">
        <Sparkles size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-tertiary">For you, as {role}</p>
        <p className="mt-0.5 text-sm text-text-primary">{advisory}</p>
      </div>
    </div>
  );
}
