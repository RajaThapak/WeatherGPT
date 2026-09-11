"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AuthUser = {
  id: number;
  email: string | null;
  phone: string | null;
  name: string | null;
  email_alerts_enabled: boolean;
  last_location_name: string | null;
};

type SignupInput = { email?: string; phone?: string; password: string; name?: string };

type AuthContextValue = {
  user: AuthUser | null;
  // False until the initial /me check (cookie restore) has resolved — lets
  // callers avoid flashing a "signed out" state before we actually know.
  hasLoaded: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  setEmailAlerts: (enabled: boolean) => Promise<void>;
  syncLocation: (lat: number, lon: number, name: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.detail ?? `Request failed: HTTP ${res.status}`;
  } catch {
    return `Request failed: HTTP ${res.status}`;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
        if (res.ok) setUser(await res.json());
      } catch {
        // Backend unreachable — treat as signed out rather than blocking the app.
      } finally {
        setHasLoaded(true);
      }
    })();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setUser(await res.json());
  };

  const signup = async (input: SignupInput) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setUser(await res.json());
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    setUser(null);
  };

  const setEmailAlerts = async (enabled: boolean) => {
    const res = await fetch(`${API_URL}/api/auth/email-alerts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setUser(await res.json());
  };

  // Best-effort, fire-and-forget — keeps the signed-in user's last-known
  // location in sync on the backend (for the email digest/change-watch
  // loop) without blocking the UI on it or surfacing errors for something
  // the user never directly asked for.
  const syncLocation = (lat: number, lon: number, name: string) => {
    if (!user) return;
    fetch(`${API_URL}/api/auth/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lat, lon, name }),
    }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{ user, hasLoaded, login, signup, logout, setEmailAlerts, syncLocation }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
