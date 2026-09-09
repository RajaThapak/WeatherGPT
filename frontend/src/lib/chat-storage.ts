import type { DisplayMessage } from "@/components/chat/ChatPanel";

const STORAGE_KEY = "weathergpt:chat-sessions";
const INACTIVITY_LIMIT_MS = 3 * 24 * 60 * 60 * 1000; // auto-delete a session after 3 days of no activity
const TITLE_MAX_LEN = 42;

export type ChatSession = {
  id: string;
  title: string;
  messages: DisplayMessage[];
  lastActivity: number;
  createdAt: number;
};

function readAll(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — history just won't persist.
  }
}

// Prunes sessions inactive for 3+ days, persists the pruned result, and
// returns the rest sorted most-recently-active first.
export function loadSessions(): ChatSession[] {
  const all = readAll();
  const now = Date.now();
  const alive = all.filter((s) => now - s.lastActivity <= INACTIVITY_LIMIT_MS);
  if (alive.length !== all.length) writeAll(alive);
  return alive.sort((a, b) => b.lastActivity - a.lastActivity);
}

export function saveSession(session: ChatSession): void {
  const all = readAll();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.unshift(session);
  writeAll(all);
}

export function deriveTitle(messages: DisplayMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim();
  return text.length > TITLE_MAX_LEN ? `${text.slice(0, TITLE_MAX_LEN)}…` : text;
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

export function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return "Yesterday";
  return `${Math.floor(diffMs / day)}d ago`;
}
