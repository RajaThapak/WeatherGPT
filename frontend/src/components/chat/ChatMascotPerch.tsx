"use client";

import Image from "next/image";

// The mascot's sitting pose, perched above the chat panel's top-right
// corner while it's open. Rendered as a sibling of the panel (not inside
// it) since the panel clips its own contents (overflow-hidden, needed for
// the message list to scroll cleanly) — anything meant to overlap its top
// edge would get cut off if nested inside it instead.
//
// `positionClassName` supplies the actual placement, since the two host
// surfaces need different positioning strategies: ChatInline's panel sits
// in normal document flow (so the perch can use `absolute` against a
// `relative` wrapper), while ChatFloating's overlay panel is itself `fixed`
// with no sized wrapper to anchor to (so the perch there mirrors it with
// its own `fixed` coordinates instead).
export function ChatMascotPerch({ positionClassName }: { positionClassName: string }) {
  return (
    <Image
      src="/chat-mascot-perch.png"
      alt=""
      width={1188}
      height={1324}
      className={`pointer-events-none z-10 h-16 w-auto drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)] [animation:mascot-perch-in_500ms_cubic-bezier(0.34,1.56,0.64,1)_both] ${positionClassName}`}
    />
  );
}
