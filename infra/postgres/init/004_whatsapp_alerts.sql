-- Proactive WhatsApp weather alerts (morning/evening digests + sudden-change
-- detection) — see backend/app/services/whatsapp.py.

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_alerts_enabled BOOLEAN NOT NULL DEFAULT false;
-- The user's most recently known location, kept in sync from the frontend
-- while signed in (see PATCH /api/auth/location) — independent of
-- push_subscriptions, since WhatsApp alerts don't need browser push consent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lon DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_name TEXT;

-- One row per user: tracks what's already been sent today (for dedup) and
-- the last-seen rain outlook (to detect a "sudden" jump between checks).
CREATE TABLE IF NOT EXISTS whatsapp_forecast_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_max_precip_probability INTEGER,
    last_checked_at TIMESTAMPTZ,
    morning_sent_date DATE,
    evening_sent_date DATE,
    change_alert_sent_date DATE
);
