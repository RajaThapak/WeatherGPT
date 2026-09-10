"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type RoleContextValue = {
  role: string | null;
  // False until the stored value (or its absence) has been read on mount —
  // lets the onboarding modal wait a tick instead of flashing on top of a
  // role that's actually already set, mirroring the SSR-safe restore
  // pattern used by location-context.tsx/theme-context.tsx.
  hasLoaded: boolean;
  setRole: (role: string | null) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);
const STORAGE_KEY = "weathergpt:user-role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRoleState(stored);
    } catch {
      // localStorage unavailable — treat as no role set.
    }
    setHasLoaded(true);
  }, []);

  const setRole = (next: string | null) => {
    setRoleState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Non-fatal — role just won't persist across reloads.
    }
  };

  return (
    <RoleContext.Provider value={{ role, hasLoaded, setRole }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
