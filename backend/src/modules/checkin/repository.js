const { pool } = require('../../database/connection');

async function findAttempt(requestId, client = pool) {
  const result = await client.query(
    `
      SELECT ca.*, t.ticket_code, t.status, t.checked_in_at,
             o.order_code, o.buyer_name, es.event_name
      FROM checkin_attempts ca
      LEFT JOIN tickets t ON t.id = ca.ticket_id
      LEFT JOIN orders o ON o.id = t.order_id
      LEFT JOIN event_settings es ON es.singleton_key = TRUE
      WHERE ca.request_id = $1
    `,
    [requestId],
  );
  return result.rows[0] ?? null;
}

async function insertAttempt(client, attempt) {
  const result = await client.query(
    `
      INSERT INTO checkin_attempts (
        request_id, ticket_id, operator_user_id, source, result, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (request_id) DO NOTHING
      RETURNING *
    `,
    [
      attempt.requestId,
      attempt.ticketId ?? null,
      attempt.operatorUserId,
      attempt.source,
      attempt.result,
      attempt.metadata ?? {},
    ],
  );
  return result.rows[0] ?? null;
}

async function markCheckedIn(client, ticketId, operatorId) {
  const result = await client.query(
    `
      UPDATE tickets
      SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $2
      WHERE id = $1 AND status = 'valid'
      RETURNING *
    `,
    [ticketId, operatorId],
  );
  return result.rows[0] ?? null;
}

module.exports = { findAttempt, insertAttempt, markCheckedIn };
