import logging

from pydantic import BaseModel

from app.cache import get_redis
from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger("weathergpt.weather")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


class DailyForecast(BaseModel):
    date: str
    temp_max_c: float
    temp_min_c: float
    kind: str


class HourlyPoint(BaseModel):
    time: str
    precipitation_probability: int
    temp_c: float


class WeatherResponse(BaseModel):
    lat: float
    lon: float
    current_time: str
    temp_c: float
    apparent_temp_c: float
    wind_speed_kmh: float
    wind_direction_deg: float
    pressure_hpa: float
    humidity_pct: int
    kind: str
    sunrise: str
    sunset: str
    daily: list[DailyForecast]
    hourly: list[HourlyPoint]


def wmo_to_kind(code: int) -> str:
    if code in (0, 1):
        return "sun"
    if code == 2:
        return "cloud-sun"
    if code in (3, 45, 48):
        return "cloud"
    if code in (51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82):
        return "rain"
    if code in (71, 73, 75, 77, 85, 86):
        return "snow"
    if code in (95, 96, 99):
        return "storm"
    return "cloud"


def _cache_key(lat: float, lon: float) -> str:
    return f"weather:{round(lat, 2)}:{round(lon, 2)}"


async def get_weather(lat: float, lon: float) -> WeatherResponse:
    redis_client = get_redis(settings.redis_url)
    key = _cache_key(lat, lon)

    try:
        cached = await redis_client.get(key)
        if cached:
            return WeatherResponse.model_validate_json(cached)
    except Exception as exc:
        logger.warning("Weather cache read failed: %s", exc)

    http = get_http_client()
    resp = await http.get(
        OPEN_METEO_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,"
            "surface_pressure,relative_humidity_2m,weather_code",
            "daily": "sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min",
            "hourly": "precipitation_probability,temperature_2m",
            "timezone": "auto",
            "forecast_days": 7,
        },
    )
    resp.raise_for_status()
    data = resp.json()

    current = data["current"]
    daily_raw = data["daily"]
    hourly_raw = data["hourly"]

    daily = [
        DailyForecast(
            date=daily_raw["time"][i],
            temp_max_c=daily_raw["temperature_2m_max"][i],
            temp_min_c=daily_raw["temperature_2m_min"][i],
            kind=wmo_to_kind(daily_raw["weather_code"][i]),
        )
        for i in range(len(daily_raw["time"]))
    ]

    # Slice hourly data starting from the current hour, far enough ahead
    # (48h) to always cover all of "tomorrow" too — not just the next few
    # hours — so the frontend's Tomorrow tab can show a real hour-by-hour
    # breakdown instead of falling back to the multi-day strip.
    current_time = current["time"]
    hourly_times = hourly_raw["time"]
    start_idx = next((i for i, t in enumerate(hourly_times) if t >= current_time), 0)
    hourly = [
        HourlyPoint(
            time=hourly_times[i],
            precipitation_probability=hourly_raw["precipitation_probability"][i],
            temp_c=hourly_raw["temperature_2m"][i],
        )
        for i in range(start_idx, min(start_idx + 48, len(hourly_times)))
    ]

    weather = WeatherResponse(
        lat=lat,
        lon=lon,
        current_time=current_time,
        temp_c=current["temperature_2m"],
        apparent_temp_c=current["apparent_temperature"],
        wind_speed_kmh=current["wind_speed_10m"],
        wind_direction_deg=current["wind_direction_10m"],
        pressure_hpa=current["surface_pressure"],
        humidity_pct=current["relative_humidity_2m"],
        kind=wmo_to_kind(current["weather_code"]),
        sunrise=daily_raw["sunrise"][0],
        sunset=daily_raw["sunset"][0],
        daily=daily,
        hourly=hourly,
    )

    try:
        await redis_client.set(key, weather.model_dump_json(), ex=settings.weather_cache_ttl_seconds)
    except Exception as exc:
        logger.warning("Weather cache write failed: %s", exc)

    return weather
