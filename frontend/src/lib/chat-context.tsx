"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DisplayMessage } from "@/components/chat/ChatPanel";
import { useLocation } from "@/lib/location-context";
import { useRole } from "@/lib/role-context";
import { useAlerts } from "@/lib/alerts-context";
import { streamChat } from "@/lib/use-chat-stream";
import { loadSessions, saveSession, deriveTitle, newSessionId, type ChatSession } from "@/lib/chat-storage";

type ChatContextValue = {
  messages: DisplayMessage[];
  sessions: ChatSession[];
  activeSessionId: string;
  isStreaming: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  startNewChat: () => void;
  switchSession: (id: string) => void;
  markPlayed: (id: string) => void;
  muted: boolean;
  toggleMute: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);
const MUTED_KEY = "weathergpt:chat-muted";

// Chat state lives here, not in a per-shell component, because two
// different shells now render it: a docked sidebar on desktop and an inline
// card on mobile (see ChatDock.tsx / ChatInline.tsx). Only one is ever
// mounted at a time (each bails out via useMediaQuery), but they need to
// show the *same* conversation rather than each keeping its own — a plain
// context, same pattern as location/role/search elsewhere in this app.
export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const { location, setLocation } = useLocation();
  const { role, setRole } = useRole();
  const { subscribe: subscribeToAlerts } = useAlerts();

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTED_KEY) === "1");
    } catch {
      // localStorage unavailable — mute preference just won't persist across reloads.
    }
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal — the toggle still works this session either way.
      }
      return next;
    });
  };

  const createdAtRef = useRef(Date.now());
  // Only true once a real user action (send/new chat) happens in this tab —
  // keeps merely loading/restoring the app from silently refreshing every
  // session's "last activity" clock (which would defeat auto-expiry).
  const activityRef = useRef(false);

  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    if (loaded.length > 0) {
      const mostRecent = loaded[0];
      setSessionId(mostRecent.id);
      createdAtRef.current = mostRecent.createdAt;
      setMessages(mostRecent.messages.map((m) => ({ ...m, autoPlay: false })));
    }
  }, []);

  // Persist once a reply has actually finished, not on every streamed
  // token — this effect's own dependency on `messages` means it would
  // otherwise re-run (and write to localStorage) dozens of times a second
  // while a response streams in, which is both wasteful and, under fast
  // token bursts, can tip React's re-render loop guard ("Maximum update
  // depth exceeded"). Skipping while isStreaming is true fixes both; the
  // effect still fires once more right when streaming ends (isStreaming is
  // itself a dependency) so the completed message always gets saved.
  useEffect(() => {
    if (!activityRef.current || messages.length === 0 || isStreaming) return;
    const session: ChatSession = {
      id: sessionId,
      title: deriveTitle(messages),
      messages,
      lastActivity: Date.now(),
      createdAt: createdAtRef.current,
    };
    saveSession(session);
    setSessions((prev) => {
      const others = prev.filter((s) => s.id !== sessionId);
      return [session, ...others].sort((a, b) => b.lastActivity - a.lastActivity);
    });
  }, [messages, sessionId, isStreaming]);

  const startNewChat = () => {
    activityRef.current = false;
    setSessionId(newSessionId());
    createdAtRef.current = Date.now();
    setMessages([]);
    setError(null);
  };

  const switchSession = (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    activityRef.current = false;
    setSessionId(target.id);
    createdAtRef.current = target.createdAt;
    setMessages(target.messages.map((m) => ({ ...m, autoPlay: false })));
    setError(null);
  };

  const markPlayed = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, autoPlay: false } : m)));
  };

  const send = async (text: string) => {
    activityRef.current = true;
    const userMsg: DisplayMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [
      ...prev,
      userMsg,
      // Every assistant reply auto-plays via TTS once it finishes streaming,
      // whether the question was typed or spoken.
      { id: assistantId, role: "assistant", content: "", autoPlay: true },
    ]);
    setIsStreaming(true);
    setError(null);

    let resolvedName = location.name;

    await streamChat(
      { message: text, history, location, role },
      {
        onLocation: (loc) => {
          resolvedName = loc.name;
          setLocation({ lat: loc.lat, lon: loc.lon, name: loc.name });
        },
        onWeather: (weather) => {
          setLocation({ lat: weather.lat, lon: weather.lon, name: resolvedName }, weather);
        },
        onAction: (action) => {
          if (action.type === "subscribe_alerts") {
            // Best-effort — if push isn't supported or permission gets
            // denied, the reply's confirmation may be slightly optimistic,
            // but nothing breaks; the bell icon still shows the real state.
            subscribeToAlerts().catch(() => {});
          } else if (action.type === "set_role") {
            setRole(action.role);
          }
        },
        onSuggestion: (suggestion) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, suggestion: suggestion.type } : m)),
          );
        },
        onToken: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
          );
        },
        onDone: () => setIsStreaming(false),
        onError: (message) => {
          setError(message);
          setIsStreaming(false);
        },
      },
    );
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessions,
        activeSessionId: sessionId,
        isStreaming,
        error,
        send,
        startNewChat,
        switchSession,
        markPlayed,
        muted,
        toggleMute,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
