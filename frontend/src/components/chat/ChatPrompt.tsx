"use client";

import Image from "next/image";

// The collapsed state of the mobile inline chat card — a normal in-flow
// element (not fixed/floating), so it never intercepts page scroll; tapping
// it expands ChatPanel (variant="inline") in the exact same spot. The
// mascot idles with a gentle float + breathing glow so it reads as a live
// avatar rather than a flat static image.
export function ChatPrompt({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask WeatherGPT"
      className="group flex w-full flex-col items-center gap-2 py-2 transition-transform duration-[120ms] active:scale-[0.97]"
    >
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div
          className="absolute h-24 w-24 rounded-full bg-accent-primary blur-2xl [animation:mascot-glow_3.2s_ease-in-out_infinite]"
        />
        <Image
          src="/chat-mascot.png"
          alt=""
          width={1188}
          height={1324}
          priority
          className="relative h-32 w-auto drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)] [animation:mascot-float_3.2s_ease-in-out_infinite] group-active:[animation-play-state:paused]"
        />
      </div>
      <span className="text-sm text-text-tertiary">Ask WeatherGPT anything…</span>
    </button>
  );
}
