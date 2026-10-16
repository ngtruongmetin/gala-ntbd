ALTER TABLE event_settings
  ALTER COLUMN ticket_price_vnd TYPE BIGINT;

ALTER TABLE orders
  DROP COLUMN total_amount_vnd;

ALTER TABLE orders
  ALTER COLUMN unit_price_vnd TYPE BIGINT,
  ALTER COLUMN transfer_content DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN total_amount_vnd BIGINT
    GENERATED ALWAYS AS (quantity::BIGINT * unit_price_vnd) STORED,
  ADD CONSTRAINT orders_buyer_name_format_check CHECK (
    buyer_name = BTRIM(buyer_name)
    AND LENGTH(buyer_name) BETWEEN 2 AND 120
  ),
  ADD CONSTRAINT orders_phone_not_blank_check CHECK (LENGTH(BTRIM(phone)) BETWEEN 10 AND 13);

CREATE INDEX orders_inventory_status_expiry_idx ON orders (status, expires_at);
