"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const HINT_VISIBLE_MS = 5000;
const HINT_FADE_MS = 400;

export function ChatButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [hintVisible, setHintVisible] = useState(true);
  const [hintMounted, setHintMounted] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setHintVisible(false), HINT_VISIBLE_MS);
    return () => clearTimeout(hideTimer);
  }, []);

  useEffect(() => {
    if (hintVisible) return;
    const unmountTimer = setTimeout(() => setHintMounted(false), HINT_FADE_MS);
    return () => clearTimeout(unmountTimer);
  }, [hintVisible]);

  const showHint = !open && hintMounted;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {showHint && (
        <div
          className={`rounded-2xl rounded-br-sm bg-surface-2 px-3 py-2 text-xs font-medium text-text-primary shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition-all duration-[400ms] ${
            hintVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          Ask about the weather anywhere
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={open ? "Close chat" : "Open WeatherGPT chat"}
        className="flex h-14 items-center gap-2 rounded-full bg-accent-primary px-5 text-sm font-semibold text-text-inverse shadow-[0_12px_24px_rgba(0,0,0,0.30)] transition-transform duration-[120ms] active:scale-[0.97]"
      >
        {open ? <X size={18} strokeWidth={2} /> : <Sparkles size={18} strokeWidth={2} />}
        {open ? "Close" : "WeatherGPT"}
      </button>
    </div>
  );
}
