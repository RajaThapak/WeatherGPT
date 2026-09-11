import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import settings
from app.db import get_pool
from app.http_client import get_http_client
from app.services.weather import get_weather

logger = logging.getLogger("weathergpt.email_alerts")
IST = ZoneInfo("Asia/Kolkata")

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email_alert(to_email: str, subject: str, body: str) -> bool:
    """Sends via Brevo's transactional email API (HTTPS, not SMTP) — Render's
    free tier blocks outbound SMTP ports entirely, which is why this isn't
    plain smtplib. Returns False (and just logs) rather than raising when
    Brevo isn't configured or the send fails — a delivery hiccup should
    never take down the watch loop."""
    if not settings.brevo_api_key or not settings.brevo_sender_email:
        logger.info("Brevo not configured — skipping email to %s: %s", to_email, subject)
        return False
    try:
        http = get_http_client()
        resp = await http.post(
            BREVO_SEND_URL,
            headers={"api-key": settings.brevo_api_key, "Content-Type": "application/json"},
            json={
                "sender": {"email": settings.brevo_sender_email, "name": settings.brevo_sender_name},
                "to": [{"email": to_email}],
                "subject": subject,
                "textContent": body,
            },
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.warning("Email send to %s failed: %s", to_email, exc)
        return False


def _max_precip_next_hours(hourly: list, hours: int) -> int:
    window = hourly[:hours]
    if not window:
        return 0
    return max(h.precipitation_probability for h in window)


# Open-Meteo's hourly `time` strings are local to the queried place
# (timezone=auto) — for Indian coordinates that's IST, matching `now_ist` —
# so a plain date-string prefix + hour comparison is enough to isolate
# tomorrow's 6-10 AM window without any timezone conversion.
def _tomorrow_morning_max_precip(hourly: list, now_ist: datetime) -> int | None:
    tomorrow = (now_ist.date() + timedelta(days=1)).isoformat()
    morning_points = [h for h in hourly if h.time.startswith(tomorrow) and 6 <= int(h.time[11:13]) <= 10]
    if not morning_points:
        return None
    return max(h.precipitation_probability for h in morning_points)


def _morning_email(location_name: str, probability: int) -> tuple[str, str]:
    subject = f"Rain expected in {location_name} today"
    body = (
        f"Good morning!\n\n{probability}% chance of rain expected in {location_name} "
        f"later today — plan accordingly.\n\n— WeatherGPT"
    )
    return subject, body


def _evening_email(location_name: str, probability: int) -> tuple[str, str]:
    subject = f"Rain expected tonight in {location_name}"
    body = (
        f"Evening update:\n\n{probability}% chance of rain expected in {location_name} "
        f"tonight into tomorrow morning.\n\n— WeatherGPT"
    )
    return subject, body


def _night_email(location_name: str, probability: int) -> tuple[str, str]:
    subject = f"Tomorrow morning's forecast for {location_name}"
    body = (
        f"Before you turn in for the night:\n\n{probability}% chance of rain expected "
        f"in {location_name} tomorrow morning (6-10 AM).\n\n— WeatherGPT"
    )
    return subject, body


def _change_email(location_name: str, probability: int) -> tuple[str, str]:
    subject = f"Rain outlook just changed for {location_name}"
    body = (
        f"Heads up — the rain outlook for {location_name} just changed: now {probability}% "
        f"chance in the next few hours.\n\n— WeatherGPT"
    )
    return subject, body


async def check_weather_changes() -> int:
    """Runs one watch cycle: for every user with email alerts on, checks
    their rain outlook and sends a morning digest, evening digest, and/or a
    sudden-change alert as appropriate. Returns how many emails were sent."""
    pool = await get_pool(settings.database_url)
    users = await pool.fetch(
        """
        SELECT u.id, u.email, u.last_lat, u.last_lon, u.last_location_name,
               s.last_max_precip_probability, s.morning_sent_date,
               s.evening_sent_date, s.change_alert_sent_date, s.night_sent_date
        FROM users u
        LEFT JOIN email_alert_state s ON s.user_id = u.id
        WHERE u.email_alerts_enabled = true
          AND u.email IS NOT NULL
          AND u.last_lat IS NOT NULL
          AND u.last_lon IS NOT NULL
        """
    )

    now_ist = datetime.now(IST)
    today: date = now_ist.date()
    sent_count = 0

    for row in users:
        try:
            sent_count += await _check_one_user(row, now_ist, today)
        except Exception as exc:
            logger.warning("Email alert check failed for user %s: %s", row["id"], exc)

    return sent_count


async def _check_one_user(row, now_ist: datetime, today: date) -> int:
    pool = await get_pool(settings.database_url)
    location_name = row["last_location_name"] or "your area"
    weather = await get_weather(row["last_lat"], row["last_lon"])
    max_probability = _max_precip_next_hours(weather.hourly, hours=12)

    prev_probability = row["last_max_precip_probability"]
    morning_sent_date = row["morning_sent_date"]
    evening_sent_date = row["evening_sent_date"]
    change_alert_sent_date = row["change_alert_sent_date"]
    night_sent_date = row["night_sent_date"]
    sent = 0

    threshold = settings.weather_alert_rain_probability_threshold
    is_rain_expected = max_probability >= threshold

    # The watch loop runs every few minutes, so "morning digest" really means
    # "the first eligible cycle after the morning hour, not yet sent today" —
    # the upper bound just keeps a morning digest from firing well into the
    # evening if the service was down earlier in the day.
    if (
        now_ist.hour >= settings.weather_alert_morning_hour_ist
        and now_ist.hour < settings.weather_alert_evening_hour_ist
        and morning_sent_date != today
        and is_rain_expected
    ):
        subject, body = _morning_email(location_name, max_probability)
        if await send_email_alert(row["email"], subject, body):
            morning_sent_date = today
            sent += 1
    elif (
        now_ist.hour >= settings.weather_alert_evening_hour_ist
        and evening_sent_date != today
        and is_rain_expected
    ):
        subject, body = _evening_email(location_name, max_probability)
        if await send_email_alert(row["email"], subject, body):
            evening_sent_date = today
            sent += 1
    elif (
        prev_probability is not None
        and is_rain_expected
        and max_probability - prev_probability >= settings.weather_alert_change_threshold_pct
        and change_alert_sent_date != today
    ):
        subject, body = _change_email(location_name, max_probability)
        if await send_email_alert(row["email"], subject, body):
            change_alert_sent_date = today
            sent += 1

    # Independent of the above chain — previews tomorrow morning specifically
    # (not "next 12h from now"), so it fires on its own schedule regardless
    # of whether a morning/evening/change email already went out today.
    if now_ist.hour >= settings.weather_alert_night_hour_ist and night_sent_date != today:
        tomorrow_morning_probability = _tomorrow_morning_max_precip(weather.hourly, now_ist)
        if tomorrow_morning_probability is not None and tomorrow_morning_probability >= threshold:
            subject, body = _night_email(location_name, tomorrow_morning_probability)
            if await send_email_alert(row["email"], subject, body):
                night_sent_date = today
                sent += 1

    await pool.execute(
        """
        INSERT INTO email_alert_state
            (user_id, last_max_precip_probability, last_checked_at,
             morning_sent_date, evening_sent_date, change_alert_sent_date, night_sent_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
            last_max_precip_probability = EXCLUDED.last_max_precip_probability,
            last_checked_at = EXCLUDED.last_checked_at,
            morning_sent_date = EXCLUDED.morning_sent_date,
            evening_sent_date = EXCLUDED.evening_sent_date,
            change_alert_sent_date = EXCLUDED.change_alert_sent_date,
            night_sent_date = EXCLUDED.night_sent_date
        """,
        row["id"],
        max_probability,
        now_ist,
        morning_sent_date,
        evening_sent_date,
        change_alert_sent_date,
        night_sent_date,
    )

    return sent
