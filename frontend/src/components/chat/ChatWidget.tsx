"use client";

import { useEffect, useRef, useState } from "react";
import { ChatButton } from "./ChatButton";
import { ChatPanel, type DisplayMessage } from "./ChatPanel";
import { useLocation } from "@/lib/location-context";
import { streamChat } from "@/lib/use-chat-stream";
import { loadSessions, saveSession, deriveTitle, newSessionId, type ChatSession } from "@/lib/chat-storage";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { location, setLocation } = useLocation();

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

  useEffect(() => {
    if (!activityRef.current || messages.length === 0) return;
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
  }, [messages, sessionId]);

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
      { message: text, history, location },
      {
        onLocation: (loc) => {
          resolvedName = loc.name;
          setLocation({ lat: loc.lat, lon: loc.lon, name: loc.name });
        },
        onWeather: (weather) => {
          setLocation({ lat: weather.lat, lon: weather.lon, name: resolvedName }, weather);
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
    <>
      <ChatButton open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <ChatPanel
          messages={messages}
          sessions={sessions}
          activeSessionId={sessionId}
          isStreaming={isStreaming}
          error={error}
          onSend={send}
          onClose={() => setOpen(false)}
          onNewChat={startNewChat}
          onSelectSession={switchSession}
        />
      )}
    </>
  );
}
