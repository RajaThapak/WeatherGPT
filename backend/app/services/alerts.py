import json
import logging
import xml.etree.ElementTree as ET
from datetime import datetime

from pydantic import BaseModel
from pywebpush import WebPushException, webpush

from app.config import settings
from app.db import get_pool
from app.http_client import get_http_client
from app.services.email_alerts import send_email_alert

logger = logging.getLogger("weathergpt.alerts")

CAP_NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}


class AlertResponse(BaseModel):
    id: str
    event: str
    headline: str
    description: str | None
    instruction: str | None
    severity: str
    urgency: str
    certainty: str
    area_desc: str
    onset: datetime
    expires: datetime
    sent: datetime


def _text(info: ET.Element, tag: str) -> str | None:
    el = info.find(f"cap:{tag}", CAP_NS)
    return el.text.strip() if el is not None and el.text else None


def _parse_cap_xml(xml_text: str) -> dict | None:
    """Parses one CAP <alert> document into the fields weather_alerts needs.
    Returns None for anything that isn't a genuine active warning (CAP's
    msgType covers Cancel/Update/Ack messages too, which we don't store)."""
    root = ET.fromstring(xml_text)
    if root.tag != "{urn:oasis:names:tc:emergency:cap:1.2}alert":
        return None

    msg_type = _text(root, "msgType")
    if msg_type not in ("Alert", "Update"):
        return None

    identifier = _text(root, "identifier")
    sent = _text(root, "sent")
    info = root.find("cap:info", CAP_NS)
    if identifier is None or sent is None or info is None:
        return None

    area = info.find("cap:area", CAP_NS)
    area_desc = _text(area, "areaDesc") if area is not None else None
    polygon_raw = area.find("cap:polygon", CAP_NS) if area is not None else None
    if area_desc is None or polygon_raw is None or not polygon_raw.text:
        # No usable geometry to match against — skip (can't geo-match it).
        return None

    # CAP polygon points are "lat,lon lat,lon ..."; WKT wants "lon lat, lon lat, ...".
    points = polygon_raw.text.strip().split()
    coords = []
    for p in points:
        lat_str, lon_str = p.split(",")
        coords.append(f"{lon_str} {lat_str}")
    if len(coords) < 4:
        return None
    wkt_polygon = f"POLYGON(({', '.join(coords)}))"

    onset = _text(info, "onset") or sent
    expires = _text(info, "expires")
    headline = _text(info, "headline")
    event = _text(info, "event")
    if expires is None or headline is None or event is None:
        return None

    return {
        "id": identifier,
        "event": event,
        "headline": headline,
        "description": _text(info, "description"),
        "instruction": _text(info, "instruction"),
        "severity": _text(info, "severity") or "Unknown",
        "urgency": _text(info, "urgency") or "Unknown",
        "certainty": _text(info, "certainty") or "Unknown",
        "area_desc": area_desc,
        "wkt_polygon": wkt_polygon,
        # asyncpg needs real datetime objects for timestamptz columns, not
        # ISO strings — CAP timestamps ("2026-09-09T07:00:00+05:30") parse
        # directly via fromisoformat.
        "onset": datetime.fromisoformat(onset),
        "expires": datetime.fromisoformat(expires),
        "sent": datetime.fromisoformat(sent),
        "raw_xml": xml_text,
    }


def _parse_rss_links(rss_text: str) -> list[str]:
    root = ET.fromstring(rss_text)
    return [item.findtext("link") for item in root.findall(".//item") if item.findtext("link")]


async def fetch_and_ingest_alerts() -> int:
    """Polls IMD's public CAP feed, parses each alert, and upserts into
    weather_alerts. Returns how many were ingested."""
    http = get_http_client()
    resp = await http.get(settings.cap_feed_url)
    resp.raise_for_status()
    links = _parse_rss_links(resp.text)

    pool = await get_pool(settings.database_url)
    ingested = 0
    for link in links:
        try:
            alert_resp = await http.get(link)
            alert_resp.raise_for_status()
            parsed = _parse_cap_xml(alert_resp.text)
            if parsed is None:
                continue
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO weather_alerts
                        (id, event, headline, description, instruction, severity, urgency,
                         certainty, area_desc, area, onset, expires, sent, raw_xml)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                            ST_GeomFromText($10, 4326), $11, $12, $13, $14)
                    ON CONFLICT (id) DO UPDATE SET
                        headline = EXCLUDED.headline,
                        description = EXCLUDED.description,
                        instruction = EXCLUDED.instruction,
                        severity = EXCLUDED.severity,
                        urgency = EXCLUDED.urgency,
                        certainty = EXCLUDED.certainty,
                        expires = EXCLUDED.expires
                    """,
                    parsed["id"],
                    parsed["event"],
                    parsed["headline"],
                    parsed["description"],
                    parsed["instruction"],
                    parsed["severity"],
                    parsed["urgency"],
                    parsed["certainty"],
                    parsed["area_desc"],
                    parsed["wkt_polygon"],
                    parsed["onset"],
                    parsed["expires"],
                    parsed["sent"],
                    parsed["raw_xml"],
                )
            ingested += 1
        except Exception as exc:
            logger.warning("Failed to ingest CAP alert %s: %s", link, exc)

    return ingested


ROLE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "farmer": ("farm",),
    "pilot": ("pilot", "fly", "aviat"),
    "fisherman": ("fish", "sail", "boat", "marine"),
    "commuter": ("commut", "bike", "cycl", "walk", "rider", "deliver"),
    "construction": ("construct", "site", "outdoor", "labour", "labor"),
}

EVENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "rain": ("rain", "flood", "shower"),
    "heat": ("heat", "hot"),
    "wind": ("wind", "cyclone", "storm", "gale"),
    "cold": ("cold", "frost", "chill"),
    "fog": ("fog", "mist", "visibility"),
}

# (event_bucket, role_bucket) -> short action cue prepended to the alert's
# own headline. Only combinations worth calling out explicitly are listed —
# anything else falls back to the plain headline, unchanged, so a
# not-yet-covered event/role combo behaves exactly like today.
ADVISORY_PREFIXES: dict[tuple[str, str], str] = {
    ("rain", "farmer"): "Hold off spraying, check field drainage — ",
    ("rain", "commuter"): "Expect delays, carry rain gear — ",
    ("rain", "construction"): "Plan for delays on exterior work — ",
    ("wind", "fisherman"): "Avoid going out to sea — ",
    ("wind", "pilot"): "Expect turbulence, check NOTAMs — ",
    ("wind", "construction"): "Secure loose materials and scaffolding — ",
    ("heat", "construction"): "Reschedule strenuous work to cooler hours — ",
    ("heat", "farmer"): "Water crops/livestock early, avoid midday exposure — ",
    ("cold", "farmer"): "Protect frost-sensitive crops — ",
    ("fog", "pilot"): "Expect low-visibility delays, check NOTAMs — ",
    ("fog", "commuter"): "Allow extra travel time, low visibility — ",
}


def _role_bucket(role: str | None) -> str | None:
    if not role:
        return None
    lowered = role.lower()
    for bucket, keywords in ROLE_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            return bucket
    return None


def _event_bucket(event: str, headline: str) -> str | None:
    lowered = f"{event} {headline}".lower()
    for bucket, keywords in EVENT_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            return bucket
    return None


def _tailor_body(event: str, headline: str, role: str | None) -> str:
    """Prefixes the alert's real headline with a short role-specific action
    cue when both the alert type and the subscriber's role are recognized —
    never invents or replaces IMD's own wording, just adds a cue in front of
    it. Falls back to the plain headline otherwise (no role set, role
    doesn't match a known bucket, or this event/role pairing isn't one of
    the ones worth calling out) — identical to today's behavior."""
    role_bucket = _role_bucket(role)
    if role_bucket is None:
        return headline
    event_bucket = _event_bucket(event, headline)
    if event_bucket is None:
        return headline
    prefix = ADVISORY_PREFIXES.get((event_bucket, role_bucket))
    return f"{prefix}{headline}" if prefix else headline


async def dispatch_new_alerts() -> int:
    """Finds (subscription, active alert) pairs not yet notified and sends a
    Web Push for each. Returns how many pushes were sent."""
    if not settings.vapid_private_key or not settings.vapid_public_key:
        logger.info("VAPID keys not configured — skipping alert dispatch.")
        return 0

    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id AS subscription_id, s.endpoint, s.p256dh, s.auth, s.role,
                   a.id AS alert_id, a.event, a.headline, a.severity
            FROM push_subscriptions s
            JOIN weather_alerts a
                ON ST_Contains(a.area, ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326))
            WHERE a.expires > now()
              AND NOT EXISTS (
                  SELECT 1 FROM alert_notifications n
                  WHERE n.subscription_id = s.id AND n.alert_id = a.id
              )
            """
        )

    sent = 0
    for row in rows:
        subscription_info = {
            "endpoint": row["endpoint"],
            "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
        }
        try:
            body = _tailor_body(row["event"], row["headline"], row["role"])
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(
                    {
                        "title": row["event"],
                        "body": body,
                        "severity": row["severity"],
                        "alertId": row["alert_id"],
                    }
                ),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            sent += 1
        except WebPushException as exc:
            logger.warning("Push failed for subscription %s: %s", row["subscription_id"], exc)
            # A 404/410 means the browser subscription is gone — clean it up
            # so we stop retrying it every cycle.
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                async with pool.acquire() as conn:
                    await conn.execute(
                        "DELETE FROM push_subscriptions WHERE id = $1", row["subscription_id"]
                    )
                continue
        except Exception as exc:
            # Anything else (e.g. malformed stored key data) shouldn't take
            # down the whole dispatch cycle for every other subscriber.
            logger.warning("Unexpected push error for subscription %s: %s", row["subscription_id"], exc)
            continue
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO alert_notifications (subscription_id, alert_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                row["subscription_id"],
                row["alert_id"],
            )

    return sent


def _severe_alert_email(
    event: str, headline: str, description: str | None, instruction: str | None,
    severity: str, area_desc: str
) -> tuple[str, str]:
    lines = [headline, ""]
    if description:
        lines.append(description)
        lines.append("")
    if instruction:
        lines.append(f"Instructions: {instruction}")
        lines.append("")
    lines.append(f"Area: {area_desc}")
    lines.append("Source: India Meteorological Department (IMD)")
    lines.append("")
    lines.append("— WeatherGPT")
    subject = f"{severity} weather alert: {event}"
    return subject, "\n".join(lines)


async def dispatch_email_alerts() -> int:
    """Finds (user, active severe alert) pairs not yet emailed and sends
    one for each — the email counterpart to dispatch_new_alerts (push).
    Targets users' last-known location (users.last_lat/last_lon), not
    push_subscriptions, since this doesn't require browser push consent."""
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT u.id AS user_id, u.email,
                   a.id AS alert_id, a.event, a.headline, a.description,
                   a.instruction, a.severity, a.area_desc
            FROM users u
            JOIN weather_alerts a
                ON ST_Contains(a.area, ST_SetSRID(ST_MakePoint(u.last_lon, u.last_lat), 4326))
            WHERE u.email_alerts_enabled = true
              AND u.email IS NOT NULL
              AND u.last_lat IS NOT NULL
              AND u.last_lon IS NOT NULL
              AND a.expires > now()
              AND NOT EXISTS (
                  SELECT 1 FROM email_alert_notifications n
                  WHERE n.user_id = u.id AND n.alert_id = a.id
              )
            """
        )

    sent = 0
    for row in rows:
        subject, body = _severe_alert_email(
            row["event"], row["headline"], row["description"], row["instruction"],
            row["severity"], row["area_desc"],
        )
        if not await send_email_alert(row["email"], subject, body):
            # Don't mark as notified — a delivery hiccup should still be
            # retried on the next poll cycle, not silently skipped forever.
            continue
        sent += 1
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO email_alert_notifications (user_id, alert_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                row["user_id"],
                row["alert_id"],
            )

    return sent


async def get_active_alerts(lat: float, lon: float) -> list[AlertResponse]:
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, event, headline, description, instruction, severity,
                   urgency, certainty, area_desc, onset, expires, sent
            FROM weather_alerts
            WHERE expires > now()
              AND ST_Contains(area, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            ORDER BY onset DESC
            """,
            lon,
            lat,
        )
    return [AlertResponse(**dict(row)) for row in rows]


async def upsert_subscription(
    endpoint: str, p256dh: str, auth: str, lat: float, lon: float, role: str | None = None
) -> None:
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO push_subscriptions (endpoint, p256dh, auth, lat, lon, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
                role = EXCLUDED.role
            """,
            endpoint,
            p256dh,
            auth,
            lat,
            lon,
            role,
        )


async def remove_subscription(endpoint: str) -> None:
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM push_subscriptions WHERE endpoint = $1", endpoint)
