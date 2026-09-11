"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "./ChatPanel";
import { ChatPrompt } from "./ChatPrompt";
import { ChatMascotPerch } from "./ChatMascotPerch";
import { useChat } from "@/lib/chat-context";
import { useAlerts } from "@/lib/alerts-context";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { useMediaQuery, DOCKED_QUERY } from "@/lib/use-media-query";

// The mobile counterpart to ChatDock: a normal in-flow card (not fixed),
// collapsed to a compact prompt by default so it never blocks page scroll,
// expanding in place — pushing the rest of the dashboard down — when tapped.
export function ChatInline() {
  const router = useRouter();
  const isDocked = useMediaQuery(DOCKED_QUERY);
  const [expanded, setExpanded] = useState(false);
  const chat = useChat();
  const { subscribed, subscribe } = useAlerts();
  const { role } = useRole();
  const { user } = useAuth();

  if (isDocked) return null;

  if (!expanded) {
    return <ChatPrompt onClick={() => (user ? setExpanded(true) : router.push("/login"))} />;
  }

  return (
    <div className="relative">
      <ChatMascotPerch positionClassName="absolute -top-14 right-2" />
      <ChatPanel
        variant="inline"
        messages={chat.messages}
        sessions={chat.sessions}
        activeSessionId={chat.activeSessionId}
        isStreaming={chat.isStreaming}
        error={chat.error}
        onSend={chat.send}
        onClose={() => setExpanded(false)}
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
  );
}
