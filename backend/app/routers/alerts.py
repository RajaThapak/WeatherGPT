from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.alerts import (
    AlertResponse,
    get_active_alerts,
    remove_subscription,
    upsert_subscription,
)

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts", response_model=list[AlertResponse])
async def alerts(lat: float, lon: float) -> list[AlertResponse]:
    try:
        return await get_active_alerts(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch alerts: {exc}") from exc


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys
    lat: float
    lon: float
    role: str | None = None


@router.post("/alerts/subscribe")
async def subscribe(body: SubscribeRequest) -> dict:
    await upsert_subscription(
        body.endpoint, body.keys.p256dh, body.keys.auth, body.lat, body.lon, body.role
    )
    return {"status": "subscribed"}


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/alerts/unsubscribe")
async def unsubscribe(body: UnsubscribeRequest) -> dict:
    await remove_subscription(body.endpoint)
    return {"status": "unsubscribed"}
