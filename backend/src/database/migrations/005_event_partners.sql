CREATE TABLE event_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (LENGTH(BTRIM(name)) BETWEEN 2 AND 160),
  logo_url TEXT NOT NULL CHECK (LENGTH(BTRIM(logo_url)) BETWEEN 1 AND 500),
  website_url TEXT CHECK (website_url IS NULL OR LENGTH(BTRIM(website_url)) BETWEEN 1 AND 500),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX event_partners_public_order_idx
  ON event_partners (active, sort_order, created_at);
