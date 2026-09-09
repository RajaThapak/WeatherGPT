import logging
from typing import Optional
from urllib.parse import quote

from pydantic import BaseModel

from app.cache import get_redis
from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger("weathergpt.geocoding")

MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding/{query}.json"


class GeocodeResult(BaseModel):
    name: str
    lat: float
    lon: float


def _cache_key(query: str) -> str:
    return f"geocode:{query.strip().lower()}"


async def geocode(query: str) -> Optional[GeocodeResult]:
    if not settings.maptiler_api_key:
        logger.warning("Geocoding requested but MAPTILER_API_KEY is not configured")
        return None

    redis_client = get_redis(settings.redis_url)
    key = _cache_key(query)

    try:
        cached = await redis_client.get(key)
        if cached:
            return GeocodeResult.model_validate_json(cached)
    except Exception as exc:
        logger.warning("Geocode cache read failed: %s", exc)

    http = get_http_client()
    resp = await http.get(
        MAPTILER_GEOCODING_URL.format(query=quote(query)),
        params={"key": settings.maptiler_api_key, "limit": 1, "autocomplete": "true", "language": "en"},
    )
    resp.raise_for_status()
    data = resp.json()

    features = data.get("features") or []
    if not features:
        return None

    top = features[0]
    lon, lat = top["center"]
    result = GeocodeResult(name=top.get("place_name", query), lat=lat, lon=lon)

    try:
        await redis_client.set(key, result.model_dump_json(), ex=settings.geocode_cache_ttl_seconds)
    except Exception as exc:
        logger.warning("Geocode cache write failed: %s", exc)

    return result
