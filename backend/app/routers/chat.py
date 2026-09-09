import logging
from collections.abc import AsyncIterable
from typing import Optional

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel

from app.config import settings
from app.services.geocoding import geocode
from app.services.llm import extract_place, stream_chat_answer
from app.services.weather import WeatherResponse, get_weather

logger = logging.getLogger("weathergpt.chat")

router = APIRouter(prefix="/api", tags=["chat"])


class LocationIn(BaseModel):
    lat: float
    lon: float
    name: str


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessageIn] = []
    location: Optional[LocationIn] = None


STYLE_RULES = (
    "Reply the way a person would answer a friend's text or spoken question — 1 to 3 short "
    "sentences for a simple question. Only mention the specific numbers the question actually "
    "asks about; don't recite the full forecast or every data point unless asked for it. "
    "Never use markdown, bullet points, headers, or bold text — plain conversational sentences "
    "only, since this is read aloud as well as shown as a chat bubble."
)


def _system_prompt(weather: Optional[WeatherResponse], location_name: str) -> str:
    if weather is None:
        return (
            "You are WeatherGPT, a helpful weather assistant. Live weather data is currently "
            "unavailable for this location — clearly say so if asked for specific numbers, "
            f"do not invent any. {STYLE_RULES}"
        )
    daily_summary = "; ".join(f"{d.date}: {d.temp_min_c}-{d.temp_max_c}°C, {d.kind}" for d in weather.daily)
    hourly_summary = "; ".join(f"{h.time}: {h.precipitation_probability}%" for h in weather.hourly)
    return (
        "You are WeatherGPT, a helpful weather assistant. Answer the user's question using "
        f"ONLY the real weather data below for {location_name}. Never invent numbers not present "
        f"here. {STYLE_RULES}\n\n"
        f"Current: {weather.temp_c}°C (feels like {weather.apparent_temp_c}°C), "
        f"wind {weather.wind_speed_kmh}km/h, humidity {weather.humidity_pct}%, "
        f"pressure {weather.pressure_hpa}hPa, condition: {weather.kind}, "
        f"sunrise {weather.sunrise}, sunset {weather.sunset}.\n"
        f"7-day forecast: {daily_summary}\n"
        f"Hourly rain chance (next few hours): {hourly_summary}"
    )


@router.post("/chat/stream", response_class=EventSourceResponse)
async def chat_stream(body: ChatRequest) -> AsyncIterable[ServerSentEvent]:
    try:
        extracted = await extract_place(body.message)
    except Exception as exc:
        logger.warning("Place extraction failed: %s", exc)
        extracted = None

    resolved_location: Optional[LocationIn] = None
    source = "current"

    if extracted and extracted.has_explicit_place and extracted.place_query:
        try:
            geo = await geocode(extracted.place_query)
        except Exception as exc:
            logger.warning("Geocoding failed: %s", exc)
            geo = None
        if geo:
            resolved_location = LocationIn(lat=geo.lat, lon=geo.lon, name=geo.name)
            source = "extracted"

    if resolved_location is None and body.location is not None:
        resolved_location = body.location
        source = "current"

    if resolved_location is not None:
        yield ServerSentEvent(
            event="location",
            data={
                "lat": resolved_location.lat,
                "lon": resolved_location.lon,
                "name": resolved_location.name,
                "source": source,
            },
        )

    weather: Optional[WeatherResponse] = None
    if resolved_location is not None:
        try:
            weather = await get_weather(resolved_location.lat, resolved_location.lon)
            yield ServerSentEvent(event="weather", data=weather.model_dump())
        except Exception as exc:
            logger.warning("Weather fetch failed in chat: %s", exc)

    if not settings.groq_api_key:
        yield ServerSentEvent(
            event="error",
            data={"message": "Chat isn't configured yet — GROQ_API_KEY is missing on the server."},
        )
        return

    location_name = resolved_location.name if resolved_location else "the user's area"
    system_prompt = _system_prompt(weather, location_name)
    history_payload = [{"role": m.role, "content": m.content} for m in body.history]

    try:
        async for delta in stream_chat_answer(system_prompt, history_payload, body.message):
            yield ServerSentEvent(event="token", data={"text": delta})
    except Exception as exc:
        logger.exception("Chat streaming failed")
        yield ServerSentEvent(event="error", data={"message": str(exc)})
        return

    yield ServerSentEvent(event="done", data={})
