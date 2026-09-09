"use client";

import { TABS, SEGMENTS, useView } from "@/lib/view-context";

export function PageTabs() {
  const { activeTab, setActiveTab, activeSegment, setActiveSegment } = useView();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2">
      <div className="no-scrollbar flex gap-5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`py-2 text-sm transition-colors duration-[120ms] ${
              activeTab === tab
                ? "font-semibold text-text-primary"
                : "font-medium text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex h-9 items-center gap-1 rounded-full bg-surface-2 p-1">
        {SEGMENTS.map((segment) => (
          <button
            key={segment}
            type="button"
            onClick={() => setActiveSegment(segment)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors duration-[200ms] ${
              activeSegment === segment
                ? "bg-accent-primary text-text-inverse"
                : "text-text-secondary"
            }`}
          >
            {segment}
          </button>
        ))}
      </div>
    </div>
  );
}
