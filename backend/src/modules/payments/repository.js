const { pool } = require('../../database/connection');

async function lockOrderByReference(client, reference) {
  const result = await client.query(
    `
      SELECT o.*, ir.state AS reservation_state, ir.expires_at AS reservation_expires_at
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      WHERE o.order_code = $1
      FOR UPDATE OF o, ir
    `,
    [reference],
  );
  return result.rows[0] ?? null;
}

async function lockOrderByTransferContent(client, transferContent) {
  const result = await client.query(
    `
      SELECT o.*, ir.state AS reservation_state, ir.expires_at AS reservation_expires_at
      FROM orders o
      JOIN inventory_reservations ir ON ir.order_id = o.id
      WHERE o.transfer_content = $1
      FOR UPDATE OF o, ir
    `,
    [transferContent],
  );
  return result.rows[0] ?? null;
}

async function insertTransaction(client, transaction) {
  const result = await client.query(
    `
      INSERT INTO payment_transactions (
        provider, provider_transaction_id, order_id, direction, amount_vnd,
        transfer_content, match_status, occurred_at, raw_payload, recorded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      transaction.provider,
      transaction.reference,
      transaction.orderId,
      transaction.direction,
      transaction.amountVnd,
      transaction.transferContent,
      transaction.matchStatus,
      transaction.occurredAt,
      transaction.rawPayload ?? {},
      transaction.recordedBy,
      transaction.notes ?? null,
    ],
  );
  return result.rows[0];
}

async function lockTransaction(client, transactionId, orderId) {
  const result = await client.query(
    `SELECT * FROM payment_transactions WHERE id = $1 AND order_id = $2 FOR UPDATE`,
    [transactionId, orderId],
  );
  return result.rows[0] ?? null;
}

async function updateTransactionReview(client, transactionId, review) {
  await client.query(
    `
      UPDATE payment_transactions
      SET match_status = $2, reviewed_by = $3, reviewed_at = NOW(), resolution_reason = $4
      WHERE id = $1
    `,
    [transactionId, review.matchStatus, review.reviewedBy, review.reason],
  );
}

async function getMatchedCreditTotal(client, orderId) {
  const result = await client.query(
    `
      SELECT COALESCE(SUM(amount_vnd), 0)::BIGINT AS total
      FROM payment_transactions
      WHERE order_id = $1 AND direction = 'credit' AND match_status = 'matched'
    `,
    [orderId],
  );
  return Number(result.rows[0].total);
}

async function updateOrderStatus(client, orderId, update) {
  const result = await client.query(
    `
      UPDATE orders
      SET status = $2,
          paid_at = COALESCE($3, paid_at),
          review_previous_status = $4,
          refund_requested_at = COALESCE($5, refund_requested_at),
          refund_requested_by = COALESCE($6, refund_requested_by),
          refund_reason = COALESCE($7, refund_reason),
          refunded_at = COALESCE($8, refunded_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      orderId,
      update.status,
      update.paidAt ?? null,
      update.reviewPreviousStatus ?? null,
      update.refundRequestedAt ?? null,
      update.refundRequestedBy ?? null,
      update.refundReason ?? null,
      update.refundedAt ?? null,
    ],
  );
  return result.rows[0];
}

async function updateReservation(client, orderId, update) {
  await client.query(
    `
      UPDATE inventory_reservations
      SET state = $2, expires_at = $3, released_at = $4, updated_at = NOW()
      WHERE order_id = $1
    `,
    [orderId, update.state, update.expiresAt ?? null, update.releasedAt ?? null],
  );
}

async function countCheckedInTickets(client, orderId) {
  const result = await client.query(
    `SELECT COUNT(*)::INTEGER AS count FROM tickets WHERE order_id = $1 AND status = 'checked_in'`,
    [orderId],
  );
  return result.rows[0].count;
}

async function voidOrderTickets(client, orderId, actorId, reason) {
  const result = await client.query(
    `
      UPDATE tickets
      SET status = 'void', voided_at = NOW(), voided_by = $2, void_reason = $3
      WHERE order_id = $1 AND status = 'valid'
      RETURNING id
    `,
    [orderId, actorId, reason],
  );
  return result.rows;
}

async function refundOrderTickets(client, orderId) {
  const result = await client.query(
    `
      UPDATE tickets
      SET status = 'refunded', refunded_at = NOW()
      WHERE order_id = $1 AND status = 'void'
      RETURNING id
    `,
    [orderId],
  );
  return result.rows;
}

async function listOrderTransactions(orderId, client = pool) {
  const result = await client.query(
    `
      SELECT id, provider, provider_transaction_id, direction, amount_vnd,
             match_status, occurred_at, notes, resolution_reason, created_at
      FROM payment_transactions WHERE order_id = $1 ORDER BY created_at DESC
    `,
    [orderId],
  );
  return result.rows;
}

module.exports = {
  lockOrderByReference,
  lockOrderByTransferContent,
  insertTransaction,
  lockTransaction,
  updateTransactionReview,
  getMatchedCreditTotal,
  updateOrderStatus,
  updateReservation,
  countCheckedInTickets,
  voidOrderTickets,
  refundOrderTickets,
  listOrderTransactions,
};
