"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export const TABS = ["Today", "Tomorrow", "Next 7 days"] as const;
export const SEGMENTS = ["Forecast", "Air quality"] as const;
export type Tab = (typeof TABS)[number];
export type Segment = (typeof SEGMENTS)[number];

type ViewContextValue = {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  activeSegment: Segment;
  setActiveSegment: (segment: Segment) => void;
};

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("Today");
  const [activeSegment, setActiveSegment] = useState<Segment>("Forecast");

  return (
    <ViewContext.Provider value={{ activeTab, setActiveTab, activeSegment, setActiveSegment }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used within a ViewProvider");
  return ctx;
}
