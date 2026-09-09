import logging

from pydantic import BaseModel

from app.cache import get_redis
from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger("weathergpt.air_quality")

AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"


class AirQualityResponse(BaseModel):
    lat: float
    lon: float
    us_aqi: int
    category: str
    pm2_5: float
    pm10: float
    ozone: float
    carbon_monoxide: float
    nitrogen_dioxide: float


def aqi_to_category(aqi: int) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def _cache_key(lat: float, lon: float) -> str:
    return f"air_quality:{round(lat, 2)}:{round(lon, 2)}"


async def get_air_quality(lat: float, lon: float) -> AirQualityResponse:
    redis_client = get_redis(settings.redis_url)
    key = _cache_key(lat, lon)

    try:
        cached = await redis_client.get(key)
        if cached:
            return AirQualityResponse.model_validate_json(cached)
    except Exception as exc:
        logger.warning("Air quality cache read failed: %s", exc)

    http = get_http_client()
    resp = await http.get(
        AIR_QUALITY_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "us_aqi,pm2_5,pm10,ozone,carbon_monoxide,nitrogen_dioxide",
            "timezone": "auto",
        },
    )
    resp.raise_for_status()
    current = resp.json()["current"]

    aqi = round(current["us_aqi"])
    result = AirQualityResponse(
        lat=lat,
        lon=lon,
        us_aqi=aqi,
        category=aqi_to_category(aqi),
        pm2_5=current["pm2_5"],
        pm10=current["pm10"],
        ozone=current["ozone"],
        carbon_monoxide=current["carbon_monoxide"],
        nitrogen_dioxide=current["nitrogen_dioxide"],
    )

    try:
        await redis_client.set(key, result.model_dump_json(), ex=settings.weather_cache_ttl_seconds)
    except Exception as exc:
        logger.warning("Air quality cache write failed: %s", exc)

    return result
