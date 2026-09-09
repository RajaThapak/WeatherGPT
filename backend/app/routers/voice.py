import logging

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import settings
from app.services.voice import synthesize_speech, transcribe_audio

logger = logging.getLogger("weathergpt.voice")

router = APIRouter(prefix="/api/voice", tags=["voice"])


def _require_configured() -> None:
    if not settings.sarvam_api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice isn't configured yet — SARVAM_API_KEY is missing on the server.",
        )


def _upstream_detail(exc: Exception, action: str) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        # Surface Sarvam's actual response body (the generic str(exc) only
        # gives the status line, not the real reason for the failure).
        body = exc.response.text
        logger.warning("%s failed: %s %s — %s", action, exc.response.status_code, exc.response.url, body)
        return f"{action} failed: {body}"
    logger.warning("%s failed: %s", action, exc)
    return f"{action} failed: {exc}"


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict:
    _require_configured()
    try:
        audio_bytes = await file.read()
        text = await transcribe_audio(audio_bytes, file.filename or "audio.webm", file.content_type)
        logger.info(
            "Transcribe: %d bytes, content_type=%s -> %r", len(audio_bytes), file.content_type, text
        )
        return {"text": text}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_upstream_detail(exc, "Transcription")) from exc


class SpeakRequest(BaseModel):
    text: str


@router.post("/speak")
async def speak(body: SpeakRequest) -> Response:
    _require_configured()
    try:
        audio_bytes = await synthesize_speech(body.text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_upstream_detail(exc, "Speech synthesis")) from exc
