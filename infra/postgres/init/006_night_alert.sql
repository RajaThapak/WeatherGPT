-- Third email check: a night digest previewing tomorrow morning's rain
-- outlook specifically, separate from the morning/evening next-12h checks.
ALTER TABLE email_alert_state ADD COLUMN IF NOT EXISTS night_sent_date DATE;
