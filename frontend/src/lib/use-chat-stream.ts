import type { WeatherResponse } from "./weather-api";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatLocationEvent = { lat: number; lon: number; name: string; source: string };
// Real, executable actions the backend detected in the user's message —
// the frontend is what actually performs the side effect (see
// chat-context.tsx); the backend only detects intent and tells the model
// to confirm it in words.
export type ChatActionEvent =
  | { type: "subscribe_alerts" }
  | { type: "set_role"; role: string };
// A hint to render a clickable chip under the reply — never performs
// anything by itself, unlike ChatActionEvent above (see chat-context.tsx
// and ChatPanel.tsx for how a click on one of these actually does something).
export type ChatSuggestionEvent = { type: "enable_alerts" | "set_role" };
// Which cities (if any) this reply actually compared — echoed back as
// `compared_locations` on the next request so a place-less follow-up ("tell
// me again") keeps comparing the same cities instead of losing them. Empty
// means this reply wasn't a comparison, clearing any previously-remembered set.
export type ChatComparisonLocation = { lat: number; lon: number; name: string };

type Callbacks = {
  onLocation?: (loc: ChatLocationEvent) => void;
  onWeather?: (weather: WeatherResponse) => void;
  onAction?: (action: ChatActionEvent) => void;
  onSuggestion?: (suggestion: ChatSuggestionEvent) => void;
  onComparisonLocations?: (locations: ChatComparisonLocation[]) => void;
  onToken?: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function streamChat(
  body: {
    message: string;
    history: ChatMessage[];
    location: { lat: number; lon: number; name: string } | null;
    role?: string | null;
    compared_locations?: ChatComparisonLocation[];
  },
  callbacks: Callbacks,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    callbacks.onError?.(err instanceof Error ? err.message : String(err));
    return;
  }

  if (!res.ok || !res.body) {
    callbacks.onError?.(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      dispatch(rawEvent, callbacks);
    }
  }
}

function dispatch(rawEvent: string, callbacks: Callbacks) {
  let eventType = "message";
  let dataLine = "";
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return;

  let data: unknown;
  try {
    data = JSON.parse(dataLine);
  } catch {
    return;
  }

  switch (eventType) {
    case "location":
      callbacks.onLocation?.(data as ChatLocationEvent);
      break;
    case "weather":
      callbacks.onWeather?.(data as WeatherResponse);
      break;
    case "action":
      callbacks.onAction?.(data as ChatActionEvent);
      break;
    case "suggestion":
      callbacks.onSuggestion?.(data as ChatSuggestionEvent);
      break;
    case "comparison_locations":
      callbacks.onComparisonLocations?.((data as { locations: ChatComparisonLocation[] }).locations);
      break;
    case "token":
      callbacks.onToken?.((data as { text: string }).text);
      break;
    case "done":
      callbacks.onDone?.();
      break;
    case "error":
      callbacks.onError?.((data as { message: string }).message);
      break;
  }
}
