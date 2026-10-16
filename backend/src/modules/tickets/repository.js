const { pool } = require('../../database/connection');

async function countTicketsForOrder(client, orderId) {
  const result = await client.query(
    `SELECT COUNT(*)::INTEGER AS count FROM tickets WHERE order_id = $1`,
    [orderId],
  );
  return result.rows[0].count;
}

async function insertTickets(client, tickets) {
  const result = await client.query(
    `
      INSERT INTO tickets (
        id, order_id, ticket_code, qr_token_hash, qr_payload, qr_key_id,
        qr_version, qr_issued_at, sequence_number, status
      )
      SELECT *
      FROM UNNEST(
        $1::UUID[], $2::UUID[], $3::TEXT[], $4::TEXT[], $5::TEXT[], $6::TEXT[],
        $7::INTEGER[], $8::TIMESTAMPTZ[], $9::INTEGER[], $10::TEXT[]
      )
      RETURNING *
    `,
    [
      tickets.map((ticket) => ticket.id),
      tickets.map((ticket) => ticket.orderId),
      tickets.map((ticket) => ticket.ticketCode),
      tickets.map((ticket) => ticket.qrHash),
      tickets.map((ticket) => ticket.qrPayload),
      tickets.map((ticket) => ticket.qrKeyId),
      tickets.map((ticket) => ticket.qrVersion),
      tickets.map((ticket) => ticket.qrIssuedAt),
      tickets.map((ticket) => ticket.sequenceNumber),
      tickets.map(() => 'valid'),
    ],
  );
  return result.rows;
}

async function insertTicketEvents(client, events) {
  if (events.length === 0) return;
  await client.query(
    `
      INSERT INTO ticket_events (
        ticket_id, action, from_status, to_status, actor_user_id, reason, metadata
      )
      SELECT * FROM UNNEST(
        $1::UUID[], $2::TEXT[], $3::TEXT[], $4::TEXT[], $5::UUID[], $6::TEXT[], $7::JSONB[]
      )
    `,
    [
      events.map((event) => event.ticketId),
      events.map((event) => event.action),
      events.map((event) => event.fromStatus ?? null),
      events.map((event) => event.toStatus ?? null),
      events.map((event) => event.actorUserId ?? null),
      events.map((event) => event.reason ?? null),
      events.map((event) => event.metadata ?? {}),
    ],
  );
}

async function listTicketsForUser(userId, client = pool) {
  const result = await client.query(
    `
      SELECT t.*, o.order_code, o.buyer_name, o.email, es.event_name, es.event_starts_at, es.venue
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      CROSS JOIN event_settings es
      WHERE o.user_id = $1 AND es.singleton_key = TRUE
      ORDER BY t.issued_at DESC, t.sequence_number
    `,
    [userId],
  );
  return result.rows;
}

async function findTicketForUser(ticketCode, userId, client = pool) {
  const result = await client.query(
    `
      SELECT t.*, o.order_code, o.buyer_name, o.email, es.event_name, es.event_starts_at, es.venue
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      CROSS JOIN event_settings es
      WHERE t.ticket_code = $1 AND o.user_id = $2 AND es.singleton_key = TRUE
      LIMIT 1
    `,
    [ticketCode, userId],
  );
  return result.rows[0] ?? null;
}

async function findTicketByCode(ticketCode, client = pool, lock = false) {
  const result = await client.query(
    `
      SELECT t.*, o.order_code, o.buyer_name, o.email, o.status AS order_status,
             es.event_name, es.event_starts_at, es.venue
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      CROSS JOIN event_settings es
      WHERE t.ticket_code = $1 AND es.singleton_key = TRUE
      LIMIT 1
      ${lock ? 'FOR UPDATE OF t' : ''}
    `,
    [ticketCode],
  );
  return result.rows[0] ?? null;
}

async function findTicketByQr(ticketId, qrHash, client, lock = true) {
  const result = await client.query(
    `
      SELECT t.*, o.order_code, o.buyer_name, o.email, o.status AS order_status,
             es.event_name, es.event_starts_at, es.venue
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      CROSS JOIN event_settings es
      WHERE t.id = $1 AND t.qr_token_hash = $2 AND es.singleton_key = TRUE
      LIMIT 1
      ${lock ? 'FOR UPDATE OF t' : ''}
    `,
    [ticketId, qrHash],
  );
  return result.rows[0] ?? null;
}

async function updateTicketState(client, ticketId, update) {
  const result = await client.query(
    `
      UPDATE tickets
      SET
        status = $2,
        checked_in_at = $3,
        checked_in_by = $4,
        voided_at = $5,
        voided_by = $6,
        void_reason = $7,
        refunded_at = $8
      WHERE id = $1
      RETURNING *
    `,
    [
      ticketId,
      update.status,
      update.checkedInAt ?? null,
      update.checkedInBy ?? null,
      update.voidedAt ?? null,
      update.voidedBy ?? null,
      update.voidReason ?? null,
      update.refundedAt ?? null,
    ],
  );
  return result.rows[0];
}

async function updateTicketQr(client, ticketId, qr) {
  const result = await client.query(
    `
      UPDATE tickets
      SET qr_payload = $2, qr_token_hash = $3, qr_key_id = $4,
          qr_version = $5, qr_issued_at = $6
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, qr.payload, qr.hash, qr.keyId, qr.version, qr.issuedAt],
  );
  return result.rows[0];
}

async function getTicketEvents(ticketId, client = pool) {
  const result = await client.query(
    `
      SELECT action, from_status, to_status, reason, metadata, created_at
      FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at DESC
    `,
    [ticketId],
  );
  return result.rows;
}

async function getTicketEventsForOrder(orderId, client = pool) {
  const result = await client.query(
    `
      SELECT te.ticket_id, te.action, te.from_status, te.to_status,
             te.reason, te.metadata, te.created_at
      FROM ticket_events te
      JOIN tickets t ON t.id = te.ticket_id
      WHERE t.order_id = $1
      ORDER BY te.created_at DESC
    `,
    [orderId],
  );
  return result.rows;
}

async function listAdminTickets(filters, client = pool) {
  const offset = (filters.page - 1) * filters.pageSize;
  const result = await client.query(
    `
      SELECT t.*, o.order_code, o.buyer_name, o.email, es.event_name, es.event_starts_at, es.venue,
             COUNT(*) OVER()::INTEGER AS total_count
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      CROSS JOIN event_settings es
      WHERE es.singleton_key = TRUE
        AND ($1::TEXT IS NULL OR t.status = $1)
        AND (
          $2::TEXT IS NULL
          OR t.ticket_code ILIKE '%' || $2 || '%'
          OR o.order_code ILIKE '%' || $2 || '%'
          OR o.buyer_name ILIKE '%' || $2 || '%'
          OR o.email ILIKE '%' || $2 || '%'
        )
      ORDER BY t.issued_at DESC, t.sequence_number
      LIMIT $3 OFFSET $4
    `,
    [filters.status ?? null, filters.search ?? null, filters.pageSize, offset],
  );
  return { rows: result.rows, total: result.rows[0]?.total_count ?? 0 };
}

module.exports = {
  countTicketsForOrder,
  insertTickets,
  insertTicketEvents,
  listTicketsForUser,
  findTicketForUser,
  findTicketByCode,
  findTicketByQr,
  updateTicketState,
  updateTicketQr,
  getTicketEvents,
  getTicketEventsForOrder,
  listAdminTickets,
};
