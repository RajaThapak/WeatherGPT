"use client";

import { useEffect, useState } from "react";

// Matches the lg breakpoint already used for the dashboard's own grid
// layout — above it, chat becomes a permanent docked sidebar; below it, an
// inline collapsible card. Shared by ChatDock and ChatInline so they always
// agree on which one should be mounted.
export const DOCKED_QUERY = "(min-width: 1024px)";

// Starts false (matching SSR) and flips after mount, same reasoning as the
// localStorage-restore effects elsewhere — avoids a hydration mismatch since
// the server has no viewport to match against. Listens for live changes so
// resizing the window across the breakpoint (not just a reload) switches
// modes too.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
