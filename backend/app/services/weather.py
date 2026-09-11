import logging
import math
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel

from app.cache import get_redis
from app.config import settings
from app.http_client import get_http_client

logger = logging.getLogger("weathergpt.weather")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
# Fallback source — free, keyless, used only when Open-Meteo fails (e.g. a
# rate limit on Render's shared outbound IP). No API key needed, just a
# descriptive User-Agent per met.no's terms of use.
METNO_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete"
METNO_USER_AGENT = "WeatherGPT/1.0 github.com/RajaThapak/WeatherGPT"
IST = timezone(timedelta(hours=5, minutes=30))


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


async def _get_weather_from_open_meteo(lat: float, lon: float) -> WeatherResponse:
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

    return WeatherResponse(
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


def _metno_symbol_to_kind(symbol: str) -> str:
    s = symbol.lower()
    if "thunder" in s:
        return "storm"
    if "snow" in s or "sleet" in s:
        return "snow"
    if "rain" in s or "shower" in s:
        return "rain"
    if "cloudy" in s and "partly" not in s:
        return "cloud"
    if "partlycloudy" in s or "fair" in s:
        return "cloud-sun"
    if "clearsky" in s:
        return "sun"
    return "cloud"


def _to_ist(utc_iso: str) -> str:
    dt = datetime.fromisoformat(utc_iso.replace("Z", "+00:00"))
    return dt.astimezone(IST).strftime("%Y-%m-%dT%H:%M")


def _compute_sunrise_sunset(lat: float, lon: float, when_utc: datetime) -> tuple[str, str]:
    """Standard solar-position sunrise/sunset (simplified NOAA formula,
    accurate to within ~15-20 min since it skips the equation-of-time
    correction) — real computed astronomy from lat/lon/date, used only
    because the fallback source doesn't provide sunrise/sunset itself.
    Never an invented placeholder."""
    day_of_year = when_utc.timetuple().tm_yday
    lat_rad = math.radians(lat)
    decl = math.radians(23.45) * math.sin(math.radians(360 / 365 * (day_of_year - 81)))
    cos_hour_angle = max(-1.0, min(1.0, -math.tan(lat_rad) * math.tan(decl)))
    hour_angle = math.degrees(math.acos(cos_hour_angle))
    solar_noon_utc_hours = 12 - lon / 15
    sunrise_hours = solar_noon_utc_hours - hour_angle / 15
    sunset_hours = solar_noon_utc_hours + hour_angle / 15
    base = datetime(when_utc.year, when_utc.month, when_utc.day, tzinfo=timezone.utc)
    sunrise_utc = base + timedelta(hours=sunrise_hours)
    sunset_utc = base + timedelta(hours=sunset_hours)
    return sunrise_utc.astimezone(IST).strftime("%Y-%m-%dT%H:%M"), sunset_utc.astimezone(IST).strftime("%Y-%m-%dT%H:%M")


async def _get_weather_from_metno(lat: float, lon: float) -> WeatherResponse:
    http = get_http_client()
    resp = await http.get(
        METNO_URL,
        params={"lat": lat, "lon": lon},
        headers={"User-Agent": METNO_USER_AGENT},
    )
    resp.raise_for_status()
    data = resp.json()
    points = data["properties"]["timeseries"]

    now_point = points[0]
    now_details = now_point["data"]["instant"]["details"]
    now_symbol = (
        now_point["data"].get("next_1_hours", {}).get("summary", {}).get("symbol_code")
        or now_point["data"].get("next_6_hours", {}).get("summary", {}).get("symbol_code")
        or "cloudy"
    )

    # Daily min/max is built from ALL available points (met.no's timeseries
    # thins out to 6h resolution past ~48h but keeps going for ~9-10 days),
    # not just the 48-point hourly window below — otherwise "Next 7 days"
    # would only ever show 2-3 real days.
    daily_map: dict[str, dict] = {}
    for point in points:
        local_time = _to_ist(point["time"])
        temp = point["data"]["instant"]["details"]["air_temperature"]
        date_key = local_time[:10]
        symbol = point["data"].get("next_1_hours", {}).get("summary", {}).get("symbol_code") or point[
            "data"
        ].get("next_6_hours", {}).get("summary", {}).get("symbol_code", now_symbol)
        bucket = daily_map.setdefault(date_key, {"max": temp, "min": temp, "symbol": symbol})
        bucket["max"] = max(bucket["max"], temp)
        bucket["min"] = min(bucket["min"], temp)

    hourly: list[HourlyPoint] = []
    for point in points[:48]:
        local_time = _to_ist(point["time"])
        temp = point["data"]["instant"]["details"]["air_temperature"]
        # Met.no gives an expected precipitation amount (mm), not a
        # probability — our schema wants a percentage, so this maps the
        # real amount into a coarse probability band rather than inventing
        # a number with no basis.
        precip_amount = point["data"].get("next_1_hours", {}).get("details", {}).get("precipitation_amount")
        if precip_amount is None:
            probability = 0
        elif precip_amount <= 0:
            probability = 5
        elif precip_amount < 0.5:
            probability = 40
        elif precip_amount < 2:
            probability = 70
        else:
            probability = 90
        hourly.append(HourlyPoint(time=local_time, precipitation_probability=probability, temp_c=temp))

    daily = [
        DailyForecast(
            date=date_key,
            temp_max_c=vals["max"],
            temp_min_c=vals["min"],
            kind=_metno_symbol_to_kind(vals["symbol"]),
        )
        for date_key, vals in sorted(daily_map.items())[:7]
    ]

    now_utc = datetime.fromisoformat(now_point["time"].replace("Z", "+00:00"))
    sunrise, sunset = _compute_sunrise_sunset(lat, lon, now_utc)

    return WeatherResponse(
        lat=lat,
        lon=lon,
        current_time=_to_ist(now_point["time"]),
        temp_c=now_details["air_temperature"],
        apparent_temp_c=now_details.get("apparent_air_temperature", now_details["air_temperature"]),
        wind_speed_kmh=round(now_details["wind_speed"] * 3.6, 1),
        wind_direction_deg=now_details["wind_from_direction"],
        pressure_hpa=now_details["air_pressure_at_sea_level"],
        humidity_pct=round(now_details["relative_humidity"]),
        kind=_metno_symbol_to_kind(now_symbol),
        sunrise=sunrise,
        sunset=sunset,
        daily=daily,
        hourly=hourly,
    )


async def get_weather(lat: float, lon: float) -> WeatherResponse:
    redis_client = get_redis(settings.redis_url)
    key = _cache_key(lat, lon)

    try:
        cached = await redis_client.get(key)
        if cached:
            return WeatherResponse.model_validate_json(cached)
    except Exception as exc:
        logger.warning("Weather cache read failed: %s", exc)

    try:
        weather = await _get_weather_from_open_meteo(lat, lon)
    except Exception as exc:
        logger.warning("Open-Meteo fetch failed (%s) — falling back to met.no", exc)
        weather = await _get_weather_from_metno(lat, lon)

    try:
        await redis_client.set(key, weather.model_dump_json(), ex=settings.weather_cache_ttl_seconds)
    except Exception as exc:
        logger.warning("Weather cache write failed: %s", exc)

    return weather
