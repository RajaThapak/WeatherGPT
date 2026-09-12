"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mic, Square, Volume2, VolumeX, Loader2, History, ArrowLeft, Plus, ChevronDown } from "lucide-react";
import type { ChatMessage } from "@/lib/use-chat-stream";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { transcribeAudio, synthesizeSpeech } from "@/lib/voice-api";
import { formatRelativeTime, type ChatSession } from "@/lib/chat-storage";

// Recognizes a sentence while MORE text may still be on the way (the reply
// is still streaming in). Requires the terminal punctuation be followed by
// whitespace we've actually already received — treating "end of what's
// arrived so far" as good enough would prematurely cut a still-arriving
// decimal number (e.g. "...of 30." right before the "6°C" in the next
// token chunk) into a false sentence break. One token late is fine; one
// token early speaks the wrong thing.
const LIVE_SENTENCE_RE = /(?:[^.!?]|\.(?=\d))+[.!?]+(?=\s)/g;
// Recognizes a sentence once the full text is known for certain (the reply
// finished streaming, or an already-complete message is being replayed via
// the speaker button) — here "end of string" really does mean end, so
// it's safe to close out a trailing sentence with no trailing whitespace.
const FINAL_SENTENCE_RE = /(?:[^.!?]|\.(?=\d))+[.!?]+(?=\s|$)/g;

// Three staggered bouncing dots — shown in place of a reply's text while
// it's still being generated or is waiting for its voice to catch up to
// it, so that wait reads as "thinking" rather than a static, possibly-stuck
// looking "…".
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" aria-label="Thinking">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary" />
    </span>
  );
}

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
  // Text revealed so far, per message id, for messages whose voice is
  // live-syncing to text (see liveGatedId below) — grows one sentence at a
  // time, exactly when that sentence's audio starts playing, so the words
  // on screen never get ahead of what's being spoken.
  const [revealedText, setRevealedText] = useState<Record<string, string>>({});
  // The message id (if any) currently being displayed via revealedText
  // instead of its real streamed content — only set for a message going
  // through the live auto-play path, never for a manual replay of an
  // already-fully-shown message (replaying voice on old text shouldn't
  // blank it out and re-reveal it).
  const [liveGatedId, setLiveGatedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Aborts the whole sentence queue (not just the currently-playing clip) —
  // set while a playback loop is running, cleared when it finishes or is
  // stopped. Needed because pausing the <audio> element alone doesn't stop
  // the queue from moving on to synthesize/play the next sentence.
  const stopPlaybackRef = useRef<(() => void) | null>(null);
  // The message id the live TTS pipeline is currently feeding/speaking, if
  // any — distinguishes "still tracking this message, just feed it more
  // text as tokens arrive" from "this is a new message, start fresh".
  const activePlaybackIdRef = useRef<string | null>(null);
  // How many characters of the active message's content have already been
  // turned into queued sentences — lets feedLiveContent() look only at the
  // newly-arrived suffix on each token update instead of re-scanning from
  // the start every time.
  const spokenUpToRef = useRef(0);
  // Sentences already dispatched for synthesis, each carrying its own
  // in-flight (or already-resolved) audio promise — kicked off the instant
  // a sentence is recognized, not when its turn to play comes up, so
  // network latency overlaps with whatever's currently playing/streaming.
  const ttsQueueRef = useRef<{ text: string; promise: Promise<Blob> }[]>([]);
  // True once we know no further sentences will be added for the active
  // message (its stream finished, or it was a already-complete message
  // replayed via the speaker button) — lets the player loop tell "queue is
  // temporarily empty, more is coming" apart from "queue is empty, done".
  const ttsClosedRef = useRef(true);
  // Wakes the player loop when it's idle-waiting for either a new sentence
  // or a stop signal.
  const wakeRef = useRef<(() => void) | null>(null);
  const recorder = useVoiceRecorder();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Stop any in-progress speech immediately when the panel closes (unmounts).
  useEffect(() => {
    return () => {
      stopPlaybackRef.current?.();
    };
  }, []);

  // Stop immediately if the user mutes mid-playback, rather than letting
  // whatever's already speaking finish out.
  useEffect(() => {
    if (muted) {
      stopPlaybackRef.current?.();
      setPlayingId(null);
    }
  }, [muted]);

  // Stop speech the moment the screen locks or the app/tab is backgrounded.
  // Mobile browsers deliberately let already-playing audio keep going in
  // the background (that's what makes web-based music/podcast players
  // work), so without this a reply keeps reading itself out after the
  // phone's screen turns off instead of stopping like the rest of the UI
  // effectively does.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPlaybackRef.current?.();
        setPlayingId(null);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setDraft("");
  };

  // Synthesizes a sentence immediately (not when its turn to play comes
  // up) and pushes it onto the queue, waking the player loop if it was
  // idle-waiting for more.
  function enqueueSentence(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    ttsQueueRef.current.push({ text: trimmed, promise: synthesizeSpeech(trimmed) });
    wakeRef.current?.();
  }

  // Called on every token update for the message currently being spoken —
  // scans only the newly-arrived suffix for complete sentences and queues
  // any it finds. This is what lets speech start on the first sentence
  // while the rest of the reply is still streaming in, instead of waiting
  // for the whole message to finish first. Uses matchAll (not exec in a
  // loop) so it never mutates the shared regex's own lastIndex.
  function feedLiveContent(id: string, content: string) {
    if (activePlaybackIdRef.current !== id) return;
    const unspoken = content.slice(spokenUpToRef.current);
    let consumed = 0;
    for (const match of unspoken.matchAll(LIVE_SENTENCE_RE)) {
      enqueueSentence(match[0]);
      consumed = match.index + match[0].length;
    }
    spokenUpToRef.current += consumed;
  }

  // Called once the full text is known — flushes whatever's left
  // (including a trailing fragment with no terminal punctuation at all)
  // and marks the queue closed so the player loop knows to stop once it
  // runs dry instead of waiting for more.
  function closeLiveContent(id: string, finalContent: string) {
    if (activePlaybackIdRef.current !== id) return;
    const remainder = finalContent.slice(spokenUpToRef.current);
    let any = false;
    for (const match of remainder.matchAll(FINAL_SENTENCE_RE)) {
      enqueueSentence(match[0]);
      any = true;
    }
    if (!any && remainder.trim()) enqueueSentence(remainder);
    spokenUpToRef.current = finalContent.length;
    ttsClosedRef.current = true;
    wakeRef.current?.();
  }

  // Consumes the queue in order, playing each sentence's audio as its
  // promise resolves. Waits (rather than exiting) when the queue is
  // temporarily empty but more sentences are still expected. When `live`
  // is true, also reveals each sentence's text at the exact moment its
  // audio starts — so words and voice move together instead of text
  // racing ahead of speech.
  async function runPlaybackLoop(id: string, live: boolean) {
    let stopped = false;
    stopPlaybackRef.current = () => {
      stopped = true;
      audioRef.current?.pause();
      wakeRef.current?.();
    };
    setPlayingId(id);
    setVoiceError(null);
    try {
      while (!stopped) {
        const next = ttsQueueRef.current.shift();
        if (!next) {
          if (ttsClosedRef.current) break;
          await new Promise<void>((resolve) => {
            wakeRef.current = resolve;
          });
          wakeRef.current = null;
          continue;
        }
        const blob = await next.promise;
        if (stopped) break;
        if (live) {
          setRevealedText((prev) => ({
            ...prev,
            [id]: prev[id] ? `${prev[id]} ${next.text}` : next.text,
          }));
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.play().catch(() => resolve());
        });
      }
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Couldn't play audio");
    } finally {
      stopPlaybackRef.current = null;
      activePlaybackIdRef.current = null;
      setPlayingId(null);
      // Falls back to showing the real (complete) content instead of the
      // reconstructed reveal text — matters most if we stopped early or
      // errored partway through, so the user never gets stuck looking at
      // a permanently truncated reply.
      if (live) setLiveGatedId((prev) => (prev === id ? null : prev));
    }
  }

  // Manual replay (the per-message speaker button) — the full text is
  // already known and already fully visible, so this never gates display:
  // seed the queue with all of it at once via the same "final" path a live
  // message uses once its stream ends, but purely for audio.
  const playMessage = (id: string, text: string) => {
    if (!text.trim() || playingId) return;
    activePlaybackIdRef.current = id;
    spokenUpToRef.current = 0;
    ttsQueueRef.current = [];
    ttsClosedRef.current = false;
    runPlaybackLoop(id, false);
    closeLiveContent(id, text);
  };

  // Auto-play every assistant answer exactly once, whether the question was
  // typed or spoken — unless muted, in which case still mark it played (so
  // unmuting later doesn't cause a burst of replies from earlier). Starts
  // feeding the live pipeline as soon as the reply begins streaming, rather
  // than waiting for it to finish, so speech starts on the first sentence
  // while later sentences are still arriving.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    if (activePlaybackIdRef.current === last.id) {
      // Already tracking this message — keep feeding it regardless of
      // autoPlay's own value below. We flip that flag off ourselves the
      // moment we start (so a later rerender/reopen doesn't re-trigger),
      // but that must not also stop US from continuing to feed the very
      // message we're already speaking — otherwise everything after the
      // first token update for a message would silently go unspoken.
      if (isStreaming) {
        feedLiveContent(last.id, last.content);
      } else {
        closeLiveContent(last.id, last.content);
      }
      return;
    }

    if (!last.autoPlay || muted) return;
    if (playingId) {
      // Something else is still speaking — this message waits its turn.
      // `playingId` is a dependency below specifically so this effect
      // re-runs the moment that finishes (it clears to null), instead of
      // this message being silently skipped forever; until then it stays
      // gated (see isPendingVoice in the render below) rather than
      // flashing its full text in while a different reply is still
      // being read aloud.
      return;
    }
    // A brand-new assistant message just appeared — start tracking it
    // immediately (even before it has any content yet) so the very first
    // sentence gets queued the moment it completes.
    onMessagePlayed?.(last.id);
    activePlaybackIdRef.current = last.id;
    spokenUpToRef.current = 0;
    ttsQueueRef.current = [];
    ttsClosedRef.current = false;
    setRevealedText((prev) => ({ ...prev, [last.id]: "" }));
    setLiveGatedId(last.id);
    runPlaybackLoop(last.id, true);
    feedLiveContent(last.id, last.content);
    if (!isStreaming) closeLiveContent(last.id, last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isStreaming, muted, playingId]);

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
            {messages.map((m, i) => {
              const isLastMessage = i === messages.length - 1;
              // Frozen at generation time (was this topic chip-worthy?) but
              // only actually shown if still live-relevant — an old
              // "enable alerts" chip disappears once you're subscribed by
              // any means, not just by clicking this exact chip.
              const showEnableAlerts = m.suggestion === "enable_alerts" && !subscribed;
              const showSetRole = m.suggestion === "set_role" && !role;
              // Text and voice stay in lockstep for a live-playing reply —
              // show only what's been spoken so far (or queued to speak
              // immediately) rather than the full streamed content, so
              // words never appear ahead of the voice reading them. A
              // message still waiting its turn (autoPlay still true, but
              // something else is currently speaking) stays gated too —
              // otherwise its full text would flash in immediately while
              // an earlier reply is still being read aloud, then voice
              // would only catch up once its own turn finally starts.
              // Restricted to the LAST message only: the auto-play effect
              // only ever picks up messages[length-1], so an older message
              // that got superseded before its turn came up would
              // otherwise stay gated (blank) forever with no way to ever
              // reveal it.
              const isLiveGated = liveGatedId === m.id;
              const isPendingVoice =
                isLastMessage && m.role === "assistant" && m.autoPlay === true && !muted && !isLiveGated;
              const gated = isLiveGated || isPendingVoice;
              const displayText = gated ? (revealedText[m.id] ?? "") : m.content;
              const showPlaceholder = !displayText && (isStreaming || gated);
              return (
                <div key={m.id} className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`flex max-w-[85%] items-end gap-1.5 rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-accent-primary text-text-inverse" : "bg-surface-2 text-text-primary"
                    }`}
                  >
                    {displayText ? <span>{displayText}</span> : showPlaceholder ? <ThinkingDots /> : null}
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
