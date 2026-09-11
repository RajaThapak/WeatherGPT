import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from asyncpg import UniqueViolationError
from pydantic import BaseModel

from app.config import settings
from app.db import get_pool

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
COOKIE_NAME = "wgpt_session"


class UserOut(BaseModel):
    id: int
    email: Optional[str]
    phone: Optional[str]
    name: Optional[str]
    email_alerts_enabled: bool
    last_location_name: Optional[str]


class AuthError(Exception):
    """Raised for any user-facing auth failure (bad credentials, duplicate
    identifier, invalid format) — the router maps this to a 400/401."""


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise AuthError("Enter a valid email address.")
    return email


def normalize_phone(phone: str) -> str:
    # Canonicalize to bare digits with a country code, so the same number
    # typed differently at signup vs. login (with/without "+91", with/without
    # spaces) still matches. A bare 10-digit number is assumed Indian (+91) —
    # this app targets IMD/India — and a leading "0" trunk prefix is dropped.
    digits = re.sub(r"\D", "", phone.strip())
    if len(digits) == 10:
        digits = "91" + digits
    elif digits.startswith("0") and len(digits) == 11:
        digits = "91" + digits[1:]
    if len(digits) < 10:
        raise AuthError("Enter a valid phone number.")
    return digits


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_session_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def _row_to_user(row) -> UserOut:
    return UserOut(
        id=row["id"],
        email=row["email"],
        phone=row["phone"],
        name=row["name"],
        email_alerts_enabled=row["email_alerts_enabled"],
        last_location_name=row["last_location_name"],
    )


async def create_user(
    email: Optional[str], phone: Optional[str], password: str, name: Optional[str]
) -> UserOut:
    if not email and not phone:
        raise AuthError("Enter an email or phone number.")
    norm_email = normalize_email(email) if email else None
    norm_phone = normalize_phone(phone) if phone else None
    password_hash = hash_password(password)

    pool = await get_pool(settings.database_url)
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO users (email, phone, password_hash, name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, phone, name, email_alerts_enabled, last_location_name
            """,
            norm_email,
            norm_phone,
            password_hash,
            name.strip() if name else None,
        )
    except UniqueViolationError:
        raise AuthError("An account with that email or phone number already exists.")
    return _row_to_user(row)


def _normalize_identifier_for_lookup(identifier: str) -> str:
    identifier = identifier.strip()
    if "@" in identifier:
        return identifier.lower()
    try:
        return normalize_phone(identifier)
    except AuthError:
        return identifier


async def authenticate_user(identifier: str, password: str) -> UserOut:
    lookup = _normalize_identifier_for_lookup(identifier)
    pool = await get_pool(settings.database_url)
    row = await pool.fetchrow(
        """
        SELECT id, email, phone, name, password_hash, email_alerts_enabled, last_location_name
        FROM users WHERE email = $1 OR phone = $1
        """,
        lookup,
    )
    if row is None or not verify_password(password, row["password_hash"]):
        raise AuthError("Incorrect email/phone or password.")
    return _row_to_user(row)


async def get_user_by_id(user_id: int) -> Optional[UserOut]:
    pool = await get_pool(settings.database_url)
    row = await pool.fetchrow(
        "SELECT id, email, phone, name, email_alerts_enabled, last_location_name FROM users WHERE id = $1",
        user_id,
    )
    return _row_to_user(row) if row else None


async def update_user_location(user_id: int, lat: float, lon: float, name: str) -> None:
    pool = await get_pool(settings.database_url)
    await pool.execute(
        "UPDATE users SET last_lat = $2, last_lon = $3, last_location_name = $4 WHERE id = $1",
        user_id,
        lat,
        lon,
        name,
    )


async def set_email_alerts_enabled(user_id: int, enabled: bool) -> UserOut:
    pool = await get_pool(settings.database_url)
    row = await pool.fetchrow(
        """
        UPDATE users SET email_alerts_enabled = $2 WHERE id = $1
        RETURNING id, email, phone, name, email_alerts_enabled, last_location_name
        """,
        user_id,
        enabled,
    )
    return _row_to_user(row)
