-- Store Google Calendar event ID on sessions so we can update/delete them later
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT DEFAULT NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT DEFAULT NULL;
