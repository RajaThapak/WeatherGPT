from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str
    redis_url: str
    cors_origins: str = "http://localhost:3000"

    groq_api_key: str = ""
    maptiler_api_key: str = ""

    weather_cache_ttl_seconds: int = 600
    # Past data never changes, unlike live weather — cache aggressively.
    historical_weather_cache_ttl_seconds: int = 30 * 24 * 3600
    geocode_cache_ttl_seconds: int = 86400

    groq_extract_model: str = "openai/gpt-oss-20b"
    groq_chat_model: str = "openai/gpt-oss-120b"

    openai_api_key: str = ""
    openai_stt_model: str = "gpt-4o-mini-transcribe"
    openai_tts_model: str = "gpt-4o-mini-tts"
    openai_tts_voice: str = "alloy"

    # Voice — Sarvam AI (built for Indian languages, replacing OpenAI here)
    sarvam_api_key: str = ""
    sarvam_stt_model: str = "saaras:v3"
    sarvam_tts_model: str = "bulbul:v3"
    sarvam_tts_speaker: str = "priya"
    sarvam_tts_language: str = "en-IN"

    # Weather alerts — polls IMD's own public CAP feed directly (no admin
    # publishing pipeline); Web Push delivery via VAPID.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:example@example.com"
    alert_poll_interval_seconds: int = 120
    cap_feed_url: str = "https://cap-sources.s3.amazonaws.com/in-imd-en/rss.xml"

    # Auth — email/phone + password login, session carried in an httpOnly
    # JWT cookie (not localStorage, so a client-side XSS can't read the token).
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7

    # Proactive weather alerts — morning/evening digests plus a sudden-change
    # watcher, delivered by email over Gmail SMTP. Blank username/password
    # means the feature is a no-op (logs and skips sending) rather than
    # failing, same as the other optional API keys above.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "WeatherGPT"
    weather_alert_watch_interval_seconds: int = 600
    weather_alert_rain_probability_threshold: int = 60
    weather_alert_change_threshold_pct: int = 30
    weather_alert_morning_hour_ist: int = 7
    weather_alert_evening_hour_ist: int = 18
    weather_alert_night_hour_ist: int = 21

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
