"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mic, Square, Volume2, VolumeX, Loader2, History, ArrowLeft, Plus, ChevronDown } from "lucide-react";
import type { ChatMessage } from "@/lib/use-chat-stream";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { transcribeAudio, synthesizeSpeech } from "@/lib/voice-api";
import { formatRelativeTime, type ChatSession } from "@/lib/chat-storage";

export type DisplayMessage = ChatMessage & {
  id: string;
  autoPlay?: boolean;
  // What kind of chip, if any, was suggested for this specific reply — a
  // fact frozen at generation time about whether the topic warranted one.
  // Whether it's actually *shown* is decided at render time against live
  // subscribed/role state (see below), so an old message's chip correctly
  // disappears once that action's already been taken by any means.
  suggestion?: "enable_alerts" | "set_role";
};

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
  onMessagePlayed,
  muted,
  onToggleMute,
  subscribed,
  role,
  onEnableAlerts,
  variant = "overlay",
}: {
  messages: DisplayMessage[];
  sessions: ChatSession[];
  activeSessionId: string;
  isStreaming: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClose?: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  // Flips the message's autoPlay flag off in the parent's persisted state —
  // parent state survives the panel unmounting (e.g. closing the chat on
  // mobile), unlike a ref local to this component, so a message already
  // auto-played doesn't replay just because the panel was reopened.
  onMessagePlayed?: (id: string) => void;
  // When true, new replies no longer auto-play via TTS — the per-message
  // speaker button still works, since that's a deliberate tap, not the
  // automatic behavior mute is meant to silence.
  muted: boolean;
  onToggleMute: () => void;
  // Live state used to decide whether a message's suggestion chip should
  // still render (e.g. hide "Enable alerts" once already subscribed, by
  // any means — not just by clicking the chip itself).
  subscribed: boolean;
  role: string | null;
  onEnableAlerts: () => void;
  // "overlay": full-screen floating panel with a "Close" button — used on
  // tablet/desktop widths below the docked breakpoint, or wherever a
  // takeover panel is still wanted. "docked": fills its parent exactly, no
  // fixed positioning/animation/rounding/close button — the permanent
  // desktop sidebar, always visible so there's nothing to close. "inline":
  // a normal in-flow card (not fixed) with a height cap so it grows with
  // content but scrolls its own messages past that cap, and a collapse
  // chevron instead of "Close" — the mobile card that sits directly in the
  // page, pushing the rest of the dashboard down instead of covering it.
  variant?: "overlay" | "docked" | "inline";
}) {
  const [draft, setDraft] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Stop immediately if the user mutes mid-playback, rather than letting
  // whatever's already speaking finish out.
  useEffect(() => {
    if (muted) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  }, [muted]);

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
  // typed or spoken — unless muted, in which case still mark it played (so
  // unmuting later doesn't cause a burst of replies from earlier).
  useEffect(() => {
    if (isStreaming) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.autoPlay && last.content.trim()) {
      onMessagePlayed?.(last.id);
      if (!muted) playMessage(last.id, last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isStreaming, muted]);

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
      className={
        variant === "docked"
          ? "flex h-full w-full flex-col overflow-hidden bg-surface-1"
          : variant === "inline"
            ? "flex max-h-[70vh] w-full flex-col overflow-hidden rounded-lg bg-surface-1 shadow-[0_8px_20px_rgba(0,0,0,0.15)] [animation:chat-panel-in_220ms_cubic-bezier(0.4,0,0.2,1)]"
            : // "overlay": fills whatever box its parent gives it — the
              // parent (ChatFloating) owns the actual fixed position/size,
              // so ChatMascotPerch can anchor to that same box instead of
              // needing to independently guess where this panel ends up.
              "flex h-full w-full flex-col overflow-hidden rounded-lg bg-surface-1 shadow-[0_12px_24px_rgba(0,0,0,0.35)] [animation:chat-panel-in_220ms_cubic-bezier(0.4,0,0.2,1)]"
      }
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
                onClick={onToggleMute}
                aria-label={muted ? "Unmute replies" : "Mute replies"}
                aria-pressed={muted}
                className="text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
              >
                {muted ? <VolumeX size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
              </button>
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
          {variant === "overlay" && (
            <button type="button" onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">
              Close
            </button>
          )}
          {variant === "inline" && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Collapse chat"
              className="text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
            >
              <ChevronDown size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {historyOpen ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-text-tertiary">
                Ask me about the weather anywhere — e.g. &quot;what&apos;s the weather in Tokyo?&quot; — by typing or
                tapping the mic.
              </p>
            )}
            {messages.map((m) => {
              // Frozen at generation time (was this topic chip-worthy?) but
              // only actually shown if still live-relevant — an old
              // "enable alerts" chip disappears once you're subscribed by
              // any means, not just by clicking this exact chip.
              const showEnableAlerts = m.suggestion === "enable_alerts" && !subscribed;
              const showSetRole = m.suggestion === "set_role" && !role;
              return (
                <div key={m.id} className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
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
                  {(showEnableAlerts || showSetRole) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (showEnableAlerts) {
                          onEnableAlerts();
                        } else {
                          setDraft("I'm a ");
                          inputRef.current?.focus();
                        }
                      }}
                      className="rounded-full bg-accent-primary/15 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors duration-[120ms] hover:bg-accent-primary/25"
                    >
                      {showEnableAlerts ? "Enable alerts for this" : "Tell me your role"}
                    </button>
                  )}
                </div>
              );
            })}
            {error && <div className="rounded-lg bg-alert/15 px-3 py-2 text-xs text-alert">{error}</div>}
            {voiceError && <div className="rounded-lg bg-alert/15 px-3 py-2 text-xs text-alert">{voiceError}</div>}
          </div>

          <div
            className={`flex items-center gap-2 border-t border-border-subtle p-3 ${
              variant === "overlay" ? "pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3" : ""
            }`}
          >
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
              ref={inputRef}
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
