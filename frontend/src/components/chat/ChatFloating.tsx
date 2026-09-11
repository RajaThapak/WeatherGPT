"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChatPanel } from "./ChatPanel";
import { ChatMascotPerch } from "./ChatMascotPerch";
import { useChat } from "@/lib/chat-context";
import { useAlerts } from "@/lib/alerts-context";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { useMediaQuery, DOCKED_QUERY } from "@/lib/use-media-query";

// The desktop counterpart to ChatInline: a floating mascot button, fixed
// bottom-right, that toggles the chat panel open/closed as a floating
// overlay near it — same click-to-open pattern the app originally had,
// just with the mascot as the trigger instead of a plain pill button.
export function ChatFloating() {
  const router = useRouter();
  const isDocked = useMediaQuery(DOCKED_QUERY);
  const [open, setOpen] = useState(false);
  const chat = useChat();
  const { subscribed, subscribe } = useAlerts();
  const { role } = useRole();
  const { user } = useAuth();

  if (!isDocked) return null;

  return (
    <>
      {/* Hidden while open — the panel below has its own Close button, and
          showing both mascots at once (trigger + perch) was cluttered. */}
      {!open && (
        <button
          type="button"
          onClick={() => (user ? setOpen(true) : router.push("/login"))}
          aria-label="Open WeatherGPT chat"
          className="group fixed bottom-6 right-6 z-40 flex h-28 w-28 items-center justify-center transition-transform duration-[120ms] active:scale-[0.95]"
        >
          <div className="absolute h-20 w-20 rounded-full bg-accent-primary blur-2xl [animation:mascot-glow_3.2s_ease-in-out_infinite]" />
          <Image
            src="/chat-mascot.png"
            alt=""
            width={1188}
            height={1324}
            priority
            className="relative h-28 w-auto drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)] [animation:mascot-float_3.2s_ease-in-out_infinite] group-active:[animation-play-state:paused]"
          />
        </button>
      )}
      {open && (
        // A single positioned box owns the fixed placement — ChatPanel
        // (variant="overlay") just fills it, and the perch anchors to this
        // same box via `absolute`, so it's always correctly placed relative
        // to wherever the panel actually is, regardless of viewport size
        // (fixed pixel guesses broke on shorter windows).
        <div className="fixed bottom-6 right-6 z-50 h-[480px] w-[360px] max-w-[calc(100vw-3rem)]">
          <ChatMascotPerch positionClassName="absolute -top-14 right-2" />
          <ChatPanel
            variant="overlay"
            messages={chat.messages}
            sessions={chat.sessions}
            activeSessionId={chat.activeSessionId}
            isStreaming={chat.isStreaming}
            error={chat.error}
            onSend={chat.send}
            onClose={() => setOpen(false)}
            onNewChat={chat.startNewChat}
            onSelectSession={chat.switchSession}
            onMessagePlayed={chat.markPlayed}
            muted={chat.muted}
            onToggleMute={chat.toggleMute}
            subscribed={subscribed}
            role={role}
            onEnableAlerts={() => subscribe().catch(() => {})}
          />
        </div>
      )}
    </>
  );
}
