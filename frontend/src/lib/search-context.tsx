"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { searchPlaces, type GeocodeResult } from "./geocoding";

const HISTORY_KEY = "weathergpt:search-history";
const HISTORY_LIMIT = 8;

function loadHistory(): GeocodeResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as GeocodeResult[]) : [];
  } catch {
    return [];
  }
}

type SearchContextValue = {
  query: string;
  setQuery: (q: string) => void;
  results: GeocodeResult[];
  searching: boolean;
  clear: () => void;
  history: GeocodeResult[];
  addToHistory: (r: GeocodeResult) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<GeocodeResult[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const found = await searchPlaces(query);
      setResults(found);
      setSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const clear = () => {
    setQuery("");
    setResults([]);
  };

  const addToHistory = (r: GeocodeResult) => {
    setHistory((prev) => {
      const next = [r, ...prev.filter((p) => p.name !== r.name)].slice(0, HISTORY_LIMIT);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private browsing, etc.) — history just won't persist.
      }
      return next;
    });
  };

  return (
    <SearchContext.Provider value={{ query, setQuery, results, searching, clear, history, addToHistory }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within a SearchProvider");
  return ctx;
}
