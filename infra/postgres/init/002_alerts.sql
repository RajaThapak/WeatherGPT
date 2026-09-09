-- Weather alerts, ingested by polling IMD's own public CAP feed directly
-- (no admin publishing pipeline in this MVP slice — see backend/app/services/alerts.py).

CREATE TABLE IF NOT EXISTS weather_alerts (
    id TEXT PRIMARY KEY,               -- CAP <identifier>
    event TEXT NOT NULL,
    headline TEXT NOT NULL,
    description TEXT,
    instruction TEXT,
    severity TEXT NOT NULL,
    urgency TEXT NOT NULL,
    certainty TEXT NOT NULL,
    area_desc TEXT NOT NULL,
    area geometry(Polygon, 4326) NOT NULL,
    onset TIMESTAMPTZ NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    sent TIMESTAMPTZ NOT NULL,
    raw_xml TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weather_alerts_area_gix ON weather_alerts USING GIST (area);
CREATE INDEX IF NOT EXISTS weather_alerts_expires_idx ON weather_alerts (expires);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks which (subscription, alert) pairs have already been pushed, so the
-- poll loop doesn't re-notify the same subscriber every cycle while an
-- alert stays active.
CREATE TABLE IF NOT EXISTS alert_notifications (
    subscription_id INTEGER NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL REFERENCES weather_alerts(id) ON DELETE CASCADE,
    notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subscription_id, alert_id)
);
