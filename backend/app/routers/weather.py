from fastapi import APIRouter, HTTPException

from app.services.weather import WeatherResponse, get_weather

router = APIRouter(prefix="/api", tags=["weather"])


@router.get("/weather", response_model=WeatherResponse)
async def weather(lat: float, lon: float) -> WeatherResponse:
    try:
        return await get_weather(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch weather: {exc}") from exc
