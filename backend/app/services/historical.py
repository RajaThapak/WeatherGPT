import logging
from datetime import date, timedelta
from typing import Optional

from pydantic import BaseModel

from app.cache import get_redis
from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger("weathergpt.historical")

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


class HistoricalDay(BaseModel):
    date: str
    temp_max_c: float
    temp_min_c: float
    precipitation_mm: float


class HistoricalWindow(BaseModel):
    start_date: str
    end_date: str
    days: list[HistoricalDay]
    avg_temp_max_c: float
    avg_temp_min_c: float
    total_precipitation_mm: float


def _cache_key(lat: float, lon: float, start: str, end: str) -> str:
    return f"historical:{round(lat, 2)}:{round(lon, 2)}:{start}:{end}"


def last_year_window(days_span: int = 3) -> tuple[date, date]:
    """Returns a window centered on today's calendar date exactly one year
    ago (+/- days_span days) — a short window instead of a single day, so
    one unusual day doesn't misrepresent "this time last year"."""
    today = date.today()
    try:
        anchor = today.replace(year=today.year - 1)
    except ValueError:
        # Feb 29 falling on a non-leap year a year back — nudge back a day.
        anchor = today.replace(year=today.year - 1, day=28)
    return anchor - timedelta(days=days_span), anchor + timedelta(days=days_span)


async def get_historical_window(
    lat: float, lon: float, start_date: date, end_date: date
) -> Optional[HistoricalWindow]:
    redis_client = get_redis(settings.redis_url)
    start_str, end_str = start_date.isoformat(), end_date.isoformat()
    key = _cache_key(lat, lon, start_str, end_str)

    try:
        cached = await redis_client.get(key)
        if cached:
            return HistoricalWindow.model_validate_json(cached)
    except Exception as exc:
        logger.warning("Historical cache read failed: %s", exc)

    http = get_http_client()
    resp = await http.get(
        ARCHIVE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": start_str,
            "end_date": end_str,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
            "timezone": "auto",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    daily = data.get("daily", {})
    times = daily.get("time", [])

    days = [
        HistoricalDay(
            date=times[i],
            temp_max_c=daily["temperature_2m_max"][i],
            temp_min_c=daily["temperature_2m_min"][i],
            precipitation_mm=daily["precipitation_sum"][i],
        )
        for i in range(len(times))
        # The archive can return nulls for dates too recent for final QC'd
        # data — skip those rather than let a None break the average.
        if daily["temperature_2m_max"][i] is not None
    ]
    if not days:
        return None

    window = HistoricalWindow(
        start_date=start_str,
        end_date=end_str,
        days=days,
        avg_temp_max_c=round(sum(d.temp_max_c for d in days) / len(days), 1),
        avg_temp_min_c=round(sum(d.temp_min_c for d in days) / len(days), 1),
        total_precipitation_mm=round(sum(d.precipitation_mm for d in days), 1),
    )

    try:
        await redis_client.set(key, window.model_dump_json(), ex=settings.historical_weather_cache_ttl_seconds)
    except Exception as exc:
        logger.warning("Historical cache write failed: %s", exc)

    return window
