const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const res = await fetch(`${API_URL}/api/voice/transcribe`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Transcription failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.text as string;
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Speech synthesis failed: HTTP ${res.status}`);
  }
  return res.blob();
}
