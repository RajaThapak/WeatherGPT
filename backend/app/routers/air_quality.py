from fastapi import APIRouter, HTTPException

from app.services.air_quality import AirQualityResponse, get_air_quality

router = APIRouter(prefix="/api", tags=["air_quality"])


@router.get("/air-quality", response_model=AirQualityResponse)
async def air_quality(lat: float, lon: float) -> AirQualityResponse:
    try:
        return await get_air_quality(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch air quality: {exc}") from exc
