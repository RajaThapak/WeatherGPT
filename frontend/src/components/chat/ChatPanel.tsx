"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mic, Square, Volume2, Loader2, History, ArrowLeft, Plus } from "lucide-react";
import type { ChatMessage } from "@/lib/use-chat-stream";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { transcribeAudio, synthesizeSpeech } from "@/lib/voice-api";
import { formatRelativeTime, type ChatSession } from "@/lib/chat-storage";

export type DisplayMessage = ChatMessage & { id: string; autoPlay?: boolean };

export function ChatPanel({
  messages,
  sessions,
  activeSessionId,
  isStreaming,
  error,
  onSend,
  onClose,
  onNewChat,
  onSelectSession,
}: {
  messages: DisplayMessage[];
  sessions: ChatSession[];
  activeSessionId: string;
  isStreaming: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedRef = useRef<Set<string>>(new Set());
  const recorder = useVoiceRecorder();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Stop any in-progress speech immediately when the panel closes (unmounts).
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setDraft("");
  };

  const playMessage = async (id: string, text: string) => {
    if (!text.trim() || playingId) return;
    setPlayingId(id);
    setVoiceError(null);
    try {
      const blob = await synthesizeSpeech(text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Couldn't play audio");
      setPlayingId(null);
    }
  };

  // Auto-play every assistant answer exactly once, whether the question was
  // typed or spoken — the speaker icon still works on every message too.
  useEffect(() => {
    if (isStreaming) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.autoPlay && last.content.trim() && !playedRef.current.has(last.id)) {
      playedRef.current.add(last.id);
      playMessage(last.id, last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isStreaming]);

  const toggleMic = async () => {
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      if (!blob) return;
      setVoiceError(null);
      try {
        const text = await transcribeAudio(blob);
        if (text.trim()) onSend(text);
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : "Couldn't transcribe audio");
      }
    } else {
      await recorder.start();
      if (recorder.error) setVoiceError(recorder.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-1 [animation:chat-panel-in_220ms_cubic-bezier(0.4,0,0.2,1)] sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[480px] sm:w-[360px] sm:max-w-[calc(100vw-3rem)] sm:origin-bottom-right sm:rounded-lg sm:shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-1.5">
          {historyOpen && (
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label="Back to chat"
              className="text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
            </button>
          )}
          <span className="text-sm font-semibold text-text-primary">{historyOpen ? "History" : "WeatherGPT"}</span>
        </div>
        <div className="flex items-center gap-3">
          {!historyOpen && (
            <>
              <button
                type="button"
                onClick={onNewChat}
                aria-label="New chat"
                className="text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
              >
                <Plus size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                aria-label="Chat history"
                className="text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
              >
                <History size={16} strokeWidth={1.75} />
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">
            Close
          </button>
        </div>
      </div>

      {historyOpen ? (
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <p className="p-3 text-sm text-text-tertiary">No past conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(s.id);
                      setHistoryOpen(false);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 ${
                      s.id === activeSessionId ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="truncate text-sm font-medium text-text-primary">{s.title}</span>
                    <span className="text-xs text-text-tertiary">{formatRelativeTime(s.lastActivity)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-text-tertiary">
                Ask me about the weather anywhere — e.g. &quot;what&apos;s the weather in Tokyo?&quot; — by typing or
                tapping the mic.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[85%] items-end gap-1.5 rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-accent-primary text-text-inverse" : "bg-surface-2 text-text-primary"
                  }`}
                >
                  <span>{m.content || (isStreaming ? "…" : "")}</span>
                  {m.role === "assistant" && m.content && (
                    <button
                      type="button"
                      onClick={() => playMessage(m.id, m.content)}
                      disabled={playingId !== null}
                      aria-label="Play answer"
                      className="shrink-0 text-text-tertiary transition-colors duration-[120ms] hover:text-text-primary disabled:opacity-40"
                    >
                      {playingId === m.id ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {error && <div className="rounded-lg bg-alert/15 px-3 py-2 text-xs text-alert">{error}</div>}
            {voiceError && <div className="rounded-lg bg-alert/15 px-3 py-2 text-xs text-alert">{voiceError}</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-border-subtle p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
            <button
              type="button"
              onClick={toggleMic}
              aria-label={recorder.isRecording ? "Stop recording" : "Record voice message"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-[120ms] ${
                recorder.isRecording
                  ? "bg-alert text-text-inverse"
                  : "bg-surface-2 text-text-secondary hover:bg-surface-3"
              }`}
            >
              {recorder.isRecording ? <Square size={14} /> : <Mic size={16} strokeWidth={1.75} />}
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={recorder.isRecording ? "Listening…" : "Ask about the weather…"}
              disabled={recorder.isRecording}
              className="h-10 flex-1 rounded-full bg-surface-2 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isStreaming || !draft.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-primary text-text-inverse transition-opacity duration-[120ms] disabled:opacity-40"
            >
              <Send size={16} strokeWidth={1.75} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
