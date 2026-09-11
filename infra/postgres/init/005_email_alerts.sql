-- Swaps proactive weather alerts from WhatsApp (blocked by Meta template
-- approval on a Twilio trial account) to email — same digest/change-detect
-- logic, different delivery channel. See backend/app/services/email_alerts.py.

ALTER TABLE users RENAME COLUMN whatsapp_alerts_enabled TO email_alerts_enabled;
ALTER TABLE whatsapp_forecast_state RENAME TO email_alert_state;
