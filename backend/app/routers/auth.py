from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, model_validator

from app.config import settings
from app.services.auth import (
    COOKIE_NAME,
    AuthError,
    UserOut,
    authenticate_user,
    create_session_token,
    create_user,
    decode_session_token,
    get_user_by_id,
    set_email_alerts_enabled,
    update_user_location,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_MAX_AGE = settings.jwt_expires_minutes * 60


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_session_token(user_id),
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        path="/",
    )


async def require_user_id(wgpt_session: str | None = Cookie(default=None)) -> int:
    user_id = decode_session_token(wgpt_session) if wgpt_session else None
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return user_id


class SignupRequest(BaseModel):
    email: str | None = None
    phone: str | None = None
    password: str
    name: str | None = None

    @model_validator(mode="after")
    def _require_identifier(self):
        if not (self.email or "").strip() and not (self.phone or "").strip():
            raise ValueError("Enter an email or phone number.")
        return self


class LoginRequest(BaseModel):
    identifier: str
    password: str


@router.post("/signup", response_model=UserOut)
async def signup(body: SignupRequest, response: Response) -> UserOut:
    try:
        user = await create_user(body.email, body.phone, body.password, body.name)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
async def login(body: LoginRequest, response: Response) -> UserOut:
    try:
        user = await authenticate_user(body.identifier, body.password)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
async def me(user_id: int = Depends(require_user_id)) -> UserOut:
    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return user


class LocationUpdate(BaseModel):
    lat: float
    lon: float
    name: str


@router.patch("/location")
async def update_location(body: LocationUpdate, user_id: int = Depends(require_user_id)) -> dict:
    await update_user_location(user_id, body.lat, body.lon, body.name)
    return {"status": "ok"}


class EmailAlertsUpdate(BaseModel):
    enabled: bool


@router.patch("/email-alerts", response_model=UserOut)
async def update_email_alerts(
    body: EmailAlertsUpdate, user_id: int = Depends(require_user_id)
) -> UserOut:
    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    if body.enabled and not user.email:
        raise HTTPException(
            status_code=400, detail="Add an email to your account to enable email alerts."
        )
    return await set_email_alerts_enabled(user_id, body.enabled)
