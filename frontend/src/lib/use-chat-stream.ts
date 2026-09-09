import type { WeatherResponse } from "./weather-api";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatLocationEvent = { lat: number; lon: number; name: string; source: string };

type Callbacks = {
  onLocation?: (loc: ChatLocationEvent) => void;
  onWeather?: (weather: WeatherResponse) => void;
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
