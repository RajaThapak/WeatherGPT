"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Bell, MapPin, Search, Sun, Moon, History, ChevronRight, ArrowLeft, AlertTriangle, UserCircle, HeartPulse } from "lucide-react";
import { useLocation } from "@/lib/location-context";
import { useTheme } from "@/lib/theme-context";
import { useSearch } from "@/lib/search-context";
import { useAlerts } from "@/lib/alerts-context";
import { useRole } from "@/lib/role-context";
import { useHealthRisks } from "@/lib/use-health-risks";
import { formatRelativeTime } from "@/lib/chat-storage";
import type { GeocodeResult } from "@/lib/geocoding";
import type { HealthRisk } from "@/lib/health-risk";

const HEALTH_SEVERITY_COLOR: Record<HealthRisk["severity"], string> = {
  moderate: "text-accent-warning",
  high: "text-alert",
  extreme: "text-alert",
};

function IconButton({
  children,
  active = false,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-[120ms] ${
        active
          ? "bg-accent-primary text-text-inverse"
          : "bg-surface-1 text-text-secondary hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { location, setLocation } = useLocation();
  const { query, setQuery, results, searching, clear, history, addToHistory } = useSearch();
  const { subscribed, activeAlerts, permissionDenied, subscribe, unsubscribe } = useAlerts();
  const { role, setRole } = useRole();
  const healthRisks = useHealthRisks();

  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roleEditOpen, setRoleEditOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState(role ?? "");
  const menuRef = useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setHistoryOpen(false);
        setRoleEditOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notifOpen]);

  const handleEnableAlerts = async () => {
    setSubscribing(true);
    setSubscribeError(null);
    try {
      await subscribe();
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "Couldn't enable alerts");
    } finally {
      setSubscribing(false);
    }
  };

  const pickResult = (r: GeocodeResult) => {
    setLocation({ lat: r.lat, lon: r.lon, name: r.name });
    addToHistory(r);
    clear();
  };

  const pickHistory = (r: GeocodeResult) => {
    setLocation({ lat: r.lat, lon: r.lon, name: r.name });
    setMenuOpen(false);
    setHistoryOpen(false);
  };

  const saveRole = () => {
    const trimmed = roleDraft.trim();
    setRole(trimmed || null);
    setRoleEditOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1">
      <div className="relative shrink-0" ref={menuRef}>
        <IconButton
          ariaLabel="Open menu"
          active={menuOpen}
          onClick={() => {
            setMenuOpen((v) => !v);
            setHistoryOpen(false);
          }}
        >
          <Menu size={18} strokeWidth={1.5} />
        </IconButton>

        {menuOpen && (
          <div className="absolute left-0 top-12 z-30 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg bg-surface-1 py-1 shadow-[0_12px_24px_rgba(0,0,0,0.30)]">
            {!historyOpen && !roleEditOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-text-primary transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2">
                    <History size={16} strokeWidth={1.5} className="text-text-secondary" />
                    Search history
                  </span>
                  <ChevronRight size={15} strokeWidth={1.5} className="text-text-tertiary" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoleDraft(role ?? "");
                    setRoleEditOpen(true);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-text-primary transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2">
                    <UserCircle size={16} strokeWidth={1.5} className="text-text-secondary" />
                    <span>
                      Your role
                      <span className="block text-xs text-text-tertiary">{role ?? "Not set"}</span>
                    </span>
                  </span>
                  <ChevronRight size={15} strokeWidth={1.5} className="text-text-tertiary" />
                </button>
              </>
            )}
            {historyOpen && (
              <div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex w-full items-center gap-2 border-b border-border-subtle px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <ArrowLeft size={15} strokeWidth={1.5} />
                  Search history
                </button>
                {history.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-text-tertiary">No searches yet.</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {history.map((r, i) => (
                      <li key={`${r.lat}-${r.lon}-${i}`}>
                        <button
                          type="button"
                          onClick={() => pickHistory(r)}
                          className="w-full truncate px-3 py-2 text-left text-sm text-text-primary transition-colors duration-[120ms] hover:bg-surface-2"
                        >
                          {r.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {roleEditOpen && (
              <div>
                <button
                  type="button"
                  onClick={() => setRoleEditOpen(false)}
                  className="flex w-full items-center gap-2 border-b border-border-subtle px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <ArrowLeft size={15} strokeWidth={1.5} />
                  Your role
                </button>
                <div className="px-3 py-2.5">
                  <p className="mb-2 text-xs text-text-tertiary">
                    Used to frame chat answers around what matters to you.
                  </p>
                  <input
                    type="text"
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveRole()}
                    placeholder="e.g. Pilot"
                    autoFocus
                    className="h-9 w-full rounded-md bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    {role && (
                      <button
                        type="button"
                        onClick={() => {
                          setRoleDraft("");
                          setRole(null);
                          setRoleEditOpen(false);
                        }}
                        className="rounded-md px-2.5 py-1.5 text-xs text-text-tertiary transition-colors duration-[120ms] hover:bg-surface-2"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveRole}
                      className="rounded-md bg-accent-primary px-2.5 py-1.5 text-xs font-semibold text-text-inverse transition-opacity duration-[120ms]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative shrink-0" ref={notifRef}>
        <div className="relative">
          <IconButton ariaLabel="Notifications" active={notifOpen} onClick={() => setNotifOpen((v) => !v)}>
            <Bell size={18} strokeWidth={1.5} />
          </IconButton>
          {(activeAlerts.length > 0 || healthRisks.length > 0) && (
            <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-alert ring-2 ring-bg-shell" />
          )}
        </div>

        {notifOpen && (
          <div className="absolute left-0 top-12 z-30 w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg bg-surface-1 py-1 shadow-[0_12px_24px_rgba(0,0,0,0.30)]">
            <div className="border-b border-border-subtle px-3 py-2.5 text-sm font-medium text-text-primary">
              Weather alerts
            </div>

            {!subscribed && (
              <div className="px-3 py-2.5">
                <p className="mb-2 text-xs text-text-tertiary">
                  Get notified the moment IMD issues a severe weather warning for your current location.
                </p>
                <button
                  type="button"
                  onClick={handleEnableAlerts}
                  disabled={subscribing}
                  className="w-full rounded-md bg-accent-primary px-3 py-1.5 text-xs font-semibold text-text-inverse transition-opacity duration-[120ms] disabled:opacity-50"
                >
                  {subscribing ? "Enabling…" : "Enable alerts for this location"}
                </button>
                {permissionDenied && (
                  <p className="mt-2 text-xs text-alert">
                    Notification permission was denied — enable it in your browser's site settings to
                    turn alerts on.
                  </p>
                )}
                {subscribeError && <p className="mt-2 text-xs text-alert">{subscribeError}</p>}
              </div>
            )}

            {activeAlerts.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-tertiary">No active alerts for {location.name}.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {activeAlerts.map((a) => (
                  <li key={a.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-alert" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">{a.headline}</p>
                        <p className="text-xs text-text-tertiary">
                          {a.severity} · {a.area_desc}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-tertiary opacity-70">
                          Source: IMD CAP feed · issued {formatRelativeTime(new Date(a.sent).getTime())}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {subscribed && (
              <button
                type="button"
                onClick={unsubscribe}
                className="w-full border-t border-border-subtle px-3 py-2 text-left text-xs text-text-tertiary transition-colors duration-[120ms] hover:bg-surface-2"
              >
                Turn off alerts
              </button>
            )}

            <div className="border-t border-border-subtle px-3 py-2.5 text-sm font-medium text-text-primary">
              Health risk
            </div>
            {healthRisks.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-tertiary">No elevated health risks right now.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {healthRisks.map((r) => (
                  <li key={r.label} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <HeartPulse
                        size={14}
                        strokeWidth={1.75}
                        className={`mt-0.5 shrink-0 ${HEALTH_SEVERITY_COLOR[r.severity]}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">{r.label}</p>
                        <p className="text-xs text-text-tertiary">{r.message}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-2 flex min-w-0 shrink items-center gap-1.5 text-text-primary">
        <MapPin size={16} strokeWidth={1.5} className="shrink-0 text-text-secondary" />
        <span className="max-w-[120px] truncate text-sm font-medium sm:max-w-[220px]">{location.name}</span>
      </div>

      <div className="relative order-3 flex w-full justify-center px-0 sm:order-none sm:w-auto sm:flex-1 sm:px-4">
        <div className="flex h-10 w-full max-w-sm items-center gap-2 rounded-full bg-surface-1 px-3 focus-within:ring-1 focus-within:ring-border-strong">
          <Search size={16} strokeWidth={1.5} className="text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city..."
            className="h-full w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        </div>
        {(results.length > 0 || searching) && (
          <ul className="absolute top-11 z-30 w-full max-w-sm overflow-y-auto rounded-lg bg-surface-1 p-1 shadow-[0_12px_24px_rgba(0,0,0,0.30)]">
            {searching && <li className="px-3 py-2 text-xs text-text-tertiary">Searching…</li>}
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-text-primary transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
        <IconButton ariaLabel="Light mode" active={theme === "light"} onClick={() => setTheme("light")}>
          <Sun size={18} strokeWidth={1.5} />
        </IconButton>
        <IconButton ariaLabel="Dark mode" active={theme === "dark"} onClick={() => setTheme("dark")}>
          <Moon size={18} strokeWidth={1.5} />
        </IconButton>
        <div className="ml-1 h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-accent-primary-soft to-accent-secondary" />
      </div>
    </div>
  );
}
