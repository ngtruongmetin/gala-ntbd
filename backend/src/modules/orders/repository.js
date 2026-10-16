function getDefaultPool() {
  return require('../../database/connection').pool;
}

async function lockEventSettings(client) {
  const result = await client.query(`
    SELECT
      id,
      ticket_price_vnd,
      total_capacity,
      min_tickets_per_order,
      max_tickets_per_order,
      sales_start_at,
      sales_end_at,
      reservation_minutes,
      sales_status,
      NOW() AS database_now
    FROM event_settings
    WHERE singleton_key = TRUE
    FOR UPDATE
  `);
  return result.rows[0] ?? null;
}

async function expirePendingReservations(client = getDefaultPool()) {
  const result = await client.query(`
    WITH expired_orders AS (
      UPDATE orders
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending_payment' AND expires_at <= NOW()
      RETURNING id
    ), released AS (
      UPDATE inventory_reservations ir
      SET state = 'released', expires_at = NULL, released_at = NOW(), updated_at = NOW()
      FROM expired_orders eo
      WHERE ir.order_id = eo.id AND ir.state = 'active'
      RETURNING ir.order_id
    )
    INSERT INTO order_events (order_id, action, from_status, to_status, reason)
    SELECT order_id, 'reservation_expired', 'pending_payment', 'expired', 'Reservation expired'
    FROM released
  `);
  return result.rowCount;
}

async function getReservedQuantity(client) {
  const result = await client.query(`
    SELECT COALESCE(SUM(quantity), 0)::INTEGER AS reserved_quantity
    FROM inventory_reservations
    WHERE state IN ('review_hold', 'consumed')
       OR (state = 'active' AND expires_at > NOW())
  `);
  return result.rows[0].reserved_quantity;
}

async function insertReservation(client, orderId, quantity, expiresAt) {
  await client.query(
    `INSERT INTO inventory_reservations (order_id, quantity, state, expires_at)
     VALUES ($1, $2, 'active', $3)`,
    [orderId, quantity, expiresAt],
  );
}

async function confirmOrderWithoutPayment(client, orderId) {
  const result = await client.query(
    `
      UPDATE orders
      SET status = 'paid', paid_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending_payment'
      RETURNING *
    `,
    [orderId],
  );
  await client.query(
    `
      UPDATE inventory_reservations
      SET state = 'consumed', expires_at = NULL, updated_at = NOW()
      WHERE order_id = $1 AND state = 'active'
    `,
    [orderId],
  );
  return result.rows[0];
}

async function insertOrderEvent(client, event) {
  await client.query(
    `
      INSERT INTO order_events (
        order_id, action, from_status, to_status, actor_user_id, reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      event.orderId,
      event.action,
      event.fromStatus ?? null,
      event.toStatus ?? null,
      event.actorUserId ?? null,
      event.reason ?? null,
      event.metadata ?? {},
    ],
  );
}

async function insertOrder(client, order) {
  const result = await client.query(
    `
      INSERT INTO orders (
        order_code,
        user_id,
        buyer_name,
        phone,
        email,
        quantity,
        unit_price_vnd,
        transfer_content,
        status,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_payment', $9)
      RETURNING id,
        order_code,
        buyer_name,
        phone,
        email,
        quantity,
        unit_price_vnd,
        total_amount_vnd,
        status,
        expires_at,
        created_at,
        updated_at
    `,
    [
      order.reference,
      order.userId,
      order.fullName,
      order.phone,
      order.email,
      order.quantity,
      order.unitPriceVnd,
      order.transferContent,
      order.expiresAt,
    ],
  );
  return result.rows[0];
}

async function findAuthorizedOrder(reference, userId, client = getDefaultPool()) {
  const result = await client.query(
    `
      SELECT
        o.id,
        o.user_id,
        o.order_code,
        o.buyer_name,
        o.phone,
        o.email,
        o.quantity,
        o.unit_price_vnd,
        o.total_amount_vnd,
        o.transfer_content,
        o.status,
        o.expires_at,
        o.created_at,
        o.updated_at,
        ir.state AS reservation_state,
        ir.expires_at AS reservation_expires_at
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      WHERE o.order_code = $1
        AND (
          o.user_id = $2
          OR EXISTS (
            SELECT 1
            FROM admin_permissions ap
            WHERE ap.user_id = $2 AND ap.role IN ('admin', 'super_admin')
          )
        )
      LIMIT 1
    `,
    [reference, userId],
  );
  return result.rows[0] ?? null;
}

async function findOwnedOrder(reference, userId, client = getDefaultPool()) {
  const result = await client.query(
    `
      SELECT o.*, ir.state AS reservation_state, ir.expires_at AS reservation_expires_at
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      WHERE o.order_code = $1 AND o.user_id = $2
      LIMIT 1
    `,
    [reference, userId],
  );
  return result.rows[0] ?? null;
}

async function listOrdersForUser(userId, client = getDefaultPool()) {
  const result = await client.query(
    `
      SELECT o.*, ir.state AS reservation_state, ir.expires_at AS reservation_expires_at,
             COUNT(t.id)::INTEGER AS ticket_count
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      LEFT JOIN tickets t ON t.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id, ir.state, ir.expires_at
      ORDER BY o.created_at DESC
    `,
    [userId],
  );
  return result.rows;
}

async function lockOrder(reference, client, userId = null) {
  const result = await client.query(
    `
      SELECT o.*, ir.state AS reservation_state, ir.expires_at AS reservation_expires_at
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      WHERE o.order_code = $1 AND ($2::UUID IS NULL OR o.user_id = $2)
      FOR UPDATE OF o, ir
    `,
    [reference, userId],
  );
  return result.rows[0] ?? null;
}

async function cancelPendingOrder(client, orderId, actorId, reason) {
  const result = await client.query(
    `
      UPDATE orders
      SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2,
          cancellation_reason = $3, updated_at = NOW()
      WHERE id = $1 AND status = 'pending_payment'
      RETURNING *
    `,
    [orderId, actorId, reason],
  );
  if (result.rowCount === 0) return null;
  await client.query(
    `
      UPDATE inventory_reservations
      SET state = 'released', expires_at = NULL, released_at = NOW(), updated_at = NOW()
      WHERE order_id = $1 AND state = 'active'
    `,
    [orderId],
  );
  return result.rows[0];
}

async function listAdminOrders(filters, client = getDefaultPool()) {
  const offset = (filters.page - 1) * filters.pageSize;
  const result = await client.query(
    `
      SELECT o.*, ir.state AS reservation_state, ir.expires_at AS reservation_expires_at,
             COUNT(t.id)::INTEGER AS ticket_count,
             COUNT(*) OVER()::INTEGER AS total_count
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      LEFT JOIN tickets t ON t.order_id = o.id
      WHERE ($1::TEXT IS NULL OR o.status = $1)
        AND (
          $2::TEXT IS NULL
          OR o.order_code ILIKE '%' || $2 || '%'
          OR o.buyer_name ILIKE '%' || $2 || '%'
          OR o.email ILIKE '%' || $2 || '%'
          OR o.phone ILIKE '%' || $2 || '%'
        )
      GROUP BY o.id, ir.state, ir.expires_at
      ORDER BY o.created_at DESC
      LIMIT $3 OFFSET $4
    `,
    [filters.status ?? null, filters.search ?? null, filters.pageSize, offset],
  );
  return { rows: result.rows, total: result.rows[0]?.total_count ?? 0 };
}

async function getOrderEvents(orderId, client = getDefaultPool()) {
  const result = await client.query(
    `
      SELECT action, from_status, to_status, reason, metadata, created_at
      FROM order_events WHERE order_id = $1 ORDER BY created_at DESC
    `,
    [orderId],
  );
  return result.rows;
}

module.exports = {
  lockEventSettings,
  expirePendingReservations,
  getReservedQuantity,
  insertOrder,
  insertReservation,
  confirmOrderWithoutPayment,
  insertOrderEvent,
  findAuthorizedOrder,
  findOwnedOrder,
  listOrdersForUser,
  lockOrder,
  cancelPendingOrder,
  listAdminOrders,
  getOrderEvents,
};
