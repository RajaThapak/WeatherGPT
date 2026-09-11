-- Dedup table for severe IMD alerts delivered by email — mirrors
-- alert_notifications (the push-notification dedup table) but keyed by
-- user rather than by browser push subscription, since email delivery
-- targets a signed-in account, not a specific browser.
CREATE TABLE IF NOT EXISTS email_alert_notifications (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id TEXT NOT NULL REFERENCES weather_alerts(id) ON DELETE CASCADE,
    notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, alert_id)
);
