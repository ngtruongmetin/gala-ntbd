ALTER TABLE orders
  DROP CONSTRAINT orders_status_check,
  DROP CONSTRAINT orders_check;

ALTER TABLE orders
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN cancellation_reason TEXT,
  ADD COLUMN refund_requested_at TIMESTAMPTZ,
  ADD COLUMN refund_requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN refund_reason TEXT,
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD COLUMN review_previous_status TEXT,
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending_payment',
      'payment_review',
      'paid',
      'refund_pending',
      'refunded',
      'expired',
      'cancelled'
    )
  ),
  ADD CONSTRAINT orders_paid_at_check CHECK (
    paid_at IS NULL OR status IN ('paid', 'refund_pending', 'refunded')
  ),
  ADD CONSTRAINT orders_review_previous_status_check CHECK (
    review_previous_status IS NULL
    OR review_previous_status IN ('pending_payment', 'expired', 'cancelled')
  );

UPDATE orders
SET status = 'expired', updated_at = NOW()
WHERE status = 'pending_payment' AND expires_at <= NOW();

CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  state TEXT NOT NULL CHECK (state IN ('active', 'review_hold', 'consumed', 'released')),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (state = 'active' AND expires_at IS NOT NULL AND released_at IS NULL)
    OR (state IN ('review_hold', 'consumed') AND released_at IS NULL)
    OR (state = 'released' AND released_at IS NOT NULL)
  )
);

INSERT INTO inventory_reservations (order_id, quantity, state, expires_at, released_at, created_at)
SELECT
  id,
  quantity,
  CASE
    WHEN status = 'pending_payment' AND expires_at > NOW() THEN 'active'
    WHEN status = 'payment_review' THEN 'review_hold'
    WHEN status IN ('paid', 'refund_pending') THEN 'consumed'
    ELSE 'released'
  END,
  CASE WHEN status = 'pending_payment' AND expires_at > NOW() THEN expires_at ELSE NULL END,
  CASE
    WHEN status IN ('expired', 'cancelled', 'refunded')
      OR (status = 'pending_payment' AND expires_at <= NOW())
    THEN COALESCE(updated_at, NOW())
    ELSE NULL
  END,
  created_at
FROM orders;

CREATE INDEX inventory_reservations_state_expiry_idx
  ON inventory_reservations (state, expires_at);

ALTER TABLE payment_transactions
  ADD COLUMN recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN notes TEXT,
  ADD COLUMN resolution_reason TEXT;

ALTER TABLE tickets
  DROP CONSTRAINT tickets_status_check,
  DROP CONSTRAINT tickets_check;

ALTER TABLE tickets
  ADD COLUMN sequence_number INTEGER,
  ADD COLUMN qr_payload TEXT,
  ADD COLUMN qr_key_id TEXT,
  ADD COLUMN qr_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN qr_issued_at TIMESTAMPTZ,
  ADD COLUMN voided_at TIMESTAMPTZ,
  ADD COLUMN voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN void_reason TEXT,
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD CONSTRAINT tickets_status_check CHECK (
    status IN ('valid', 'checked_in', 'void', 'refunded')
  ),
  ADD CONSTRAINT tickets_checkin_state_check CHECK (
    (status = 'checked_in' AND checked_in_at IS NOT NULL)
    OR (status <> 'checked_in' AND checked_in_at IS NULL)
  );

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY issued_at, id)::INTEGER AS number
  FROM tickets
)
UPDATE tickets
SET sequence_number = numbered.number
FROM numbered
WHERE tickets.id = numbered.id;

ALTER TABLE tickets
  ALTER COLUMN sequence_number SET NOT NULL,
  ADD CONSTRAINT tickets_order_sequence_unique UNIQUE (order_id, sequence_number);

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_events_order_created_idx ON order_events (order_id, created_at DESC);

CREATE TABLE ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ticket_events_ticket_created_idx ON ticket_events (ticket_id, created_at DESC);

CREATE TABLE checkin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE RESTRICT,
  operator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('camera', 'usb', 'manual')),
  result TEXT NOT NULL CHECK (
    result IN ('success', 'already_checked_in', 'invalid', 'revoked', 'refunded', 'unpaid')
  ),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX checkin_attempts_ticket_occurred_idx
  ON checkin_attempts (ticket_id, occurred_at DESC);

ALTER TABLE admin_permissions
  DROP CONSTRAINT admin_permissions_pkey,
  DROP CONSTRAINT admin_permissions_role_check;

ALTER TABLE admin_permissions
  ADD CONSTRAINT admin_permissions_role_check CHECK (
    role IN ('super_admin', 'admin', 'check_in')
  ),
  ADD PRIMARY KEY (user_id, role);

CREATE TABLE staff_role_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (email = LOWER(BTRIM(email))),
  role TEXT NOT NULL CHECK (role IN ('admin', 'check_in')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, role)
);

CREATE INDEX staff_role_grants_user_id_idx ON staff_role_grants (user_id);

CREATE TABLE admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_audit_events_created_idx ON admin_audit_events (created_at DESC);
