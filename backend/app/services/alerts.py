import json
import logging
import xml.etree.ElementTree as ET
from datetime import datetime

from pydantic import BaseModel
from pywebpush import WebPushException, webpush

from app.config import settings
from app.db import get_pool
from app.http_client import get_http_client

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
            SELECT s.id AS subscription_id, s.endpoint, s.p256dh, s.auth,
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
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(
                    {"title": row["event"], "body": row["headline"], "severity": row["severity"]}
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


async def get_active_alerts(lat: float, lon: float) -> list[AlertResponse]:
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, event, headline, description, instruction, severity,
                   urgency, certainty, area_desc, onset, expires
            FROM weather_alerts
            WHERE expires > now()
              AND ST_Contains(area, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            ORDER BY onset DESC
            """,
            lon,
            lat,
        )
    return [AlertResponse(**dict(row)) for row in rows]


async def upsert_subscription(endpoint: str, p256dh: str, auth: str, lat: float, lon: float) -> None:
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO push_subscriptions (endpoint, p256dh, auth, lat, lon)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth, lat = EXCLUDED.lat, lon = EXCLUDED.lon
            """,
            endpoint,
            p256dh,
            auth,
            lat,
            lon,
        )


async def remove_subscription(endpoint: str) -> None:
    pool = await get_pool(settings.database_url)
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM push_subscriptions WHERE endpoint = $1", endpoint)
