"use client";

import { useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { ChatPrompt } from "./ChatPrompt";
import { ChatMascotPerch } from "./ChatMascotPerch";
import { useChat } from "@/lib/chat-context";
import { useMediaQuery, DOCKED_QUERY } from "@/lib/use-media-query";

// The mobile counterpart to ChatDock: a normal in-flow card (not fixed),
// collapsed to a compact prompt by default so it never blocks page scroll,
// expanding in place — pushing the rest of the dashboard down — when tapped.
export function ChatInline() {
  const isDocked = useMediaQuery(DOCKED_QUERY);
  const [expanded, setExpanded] = useState(false);
  const chat = useChat();

  if (isDocked) return null;

  if (!expanded) {
    return <ChatPrompt onClick={() => setExpanded(true)} />;
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
      />
    </div>
  );
}
