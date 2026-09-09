import base64
import logging

from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger("weathergpt.voice")

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

# bulbul:v3's documented max input length.
TTS_MAX_CHARS = 2500


async def transcribe_audio(file_bytes: bytes, filename: str, content_type: str | None = None) -> str:
    http = get_http_client()
    # Without an explicit content type, httpx falls back to
    # mimetypes.guess_type(filename), which maps ".webm" to "video/webm" (not
    # "audio/webm") — Sarvam rejects that with a 400. Forward the browser's
    # real Blob MIME type instead, falling back to "audio/webm" only if it's
    # missing (never trust the filename-derived guess). Sarvam's allow-list is
    # an exact-string match with no codec parameter (e.g. "audio/webm", not
    # "audio/webm;codecs=opus"), so strip everything after the ";" — the
    # browser's MediaRecorder default includes that suffix and gets a 400
    # "Invalid file type" otherwise.
    clean_content_type = (content_type or "audio/webm").split(";")[0].strip()
    resp = await http.post(
        SARVAM_STT_URL,
        headers={"api-subscription-key": settings.sarvam_api_key},
        files={"file": (filename, file_bytes, clean_content_type)},
        data={"model": settings.sarvam_stt_model, "language_code": "unknown"},
    )
    resp.raise_for_status()
    data = resp.json()
    return (data.get("transcript") or "").strip()


async def synthesize_speech(text: str) -> bytes:
    http = get_http_client()
    resp = await http.post(
        SARVAM_TTS_URL,
        headers={"api-subscription-key": settings.sarvam_api_key},
        json={
            "text": text[:TTS_MAX_CHARS],
            "language_code": settings.sarvam_tts_language,
            "speaker": settings.sarvam_tts_speaker,
            "model": settings.sarvam_tts_model,
            "output_audio_codec": "mp3",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    audios = data.get("audios") or []
    if not audios:
        raise ValueError("Sarvam TTS returned no audio")
    return base64.b64decode(audios[0])
