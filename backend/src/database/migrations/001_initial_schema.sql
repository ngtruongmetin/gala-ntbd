CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL CHECK (email_verified),
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email));

CREATE TABLE event_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton_key),
  event_name TEXT NOT NULL CHECK (LENGTH(TRIM(event_name)) > 0),
  ticket_price_vnd INTEGER NOT NULL CHECK (ticket_price_vnd > 0),
  total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
  min_tickets_per_order INTEGER NOT NULL CHECK (min_tickets_per_order > 0),
  max_tickets_per_order INTEGER NOT NULL,
  sales_start_at TIMESTAMPTZ NOT NULL,
  sales_end_at TIMESTAMPTZ NOT NULL,
  reservation_minutes INTEGER NOT NULL CHECK (reservation_minutes BETWEEN 1 AND 1440),
  sales_status TEXT NOT NULL DEFAULT 'paused' CHECK (sales_status IN ('open', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (max_tickets_per_order >= min_tickets_per_order),
  CHECK (max_tickets_per_order <= total_capacity),
  CHECK (sales_end_at > sales_start_at)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_name TEXT NOT NULL CHECK (buyer_name = UPPER(buyer_name)),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_vnd INTEGER NOT NULL CHECK (unit_price_vnd > 0),
  total_amount_vnd INTEGER GENERATED ALWAYS AS (quantity * unit_price_vnd) STORED,
  transfer_content TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('pending_payment', 'paid', 'expired', 'cancelled', 'payment_review')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (paid_at IS NULL OR status IN ('paid', 'payment_review'))
);

CREATE INDEX orders_user_id_created_at_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_pending_expiry_idx ON orders (expires_at)
  WHERE status = 'pending_payment';

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
  transfer_content TEXT NOT NULL,
  match_status TEXT NOT NULL CHECK (
    match_status IN ('matched', 'unmatched', 'amount_mismatch', 'late', 'ignored')
  ),
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX payment_transactions_order_id_idx ON payment_transactions (order_id);

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  ticket_code TEXT NOT NULL UNIQUE,
  qr_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'checked_in', 'void')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (
    (status = 'checked_in' AND checked_in_at IS NOT NULL)
    OR (status <> 'checked_in' AND checked_in_at IS NULL)
  )
);

CREATE INDEX tickets_order_id_idx ON tickets (order_id);

CREATE TABLE admin_permissions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'check_in')),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);
