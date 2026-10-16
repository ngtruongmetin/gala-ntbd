ALTER TABLE event_settings
  ADD COLUMN event_subtitle TEXT,
  ADD COLUMN venue TEXT,
  ADD COLUMN event_starts_at TIMESTAMPTZ;
