ALTER TABLE event_partners
  DROP CONSTRAINT event_partners_logo_url_check,
  ALTER COLUMN logo_url DROP NOT NULL,
  ADD COLUMN logo_data BYTEA,
  ADD COLUMN logo_mime TEXT;

ALTER TABLE event_partners
  ADD CONSTRAINT event_partners_logo_source_check CHECK (
    (logo_data IS NOT NULL AND logo_mime IN ('image/png', 'image/jpeg', 'image/webp'))
    OR (logo_data IS NULL AND logo_url IS NOT NULL AND LENGTH(BTRIM(logo_url)) BETWEEN 1 AND 500)
  );
