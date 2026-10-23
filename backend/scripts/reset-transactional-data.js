const { withTransaction, closeDatabase } = require('../src/database/connection');
const { env } = require('../src/config/env');
const { logger } = require('../src/config/logger');

async function resetTransactionalData() {
  if (!env.allowTransactionDataReset || !process.argv.includes('--confirm-reset')) {
    throw new Error(
      'Reset refused. Set ALLOW_TRANSACTION_DATA_RESET=true and pass --confirm-reset.',
    );
  }

  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7182026)');
    const counts = (
      await client.query(`
        SELECT
          (SELECT COUNT(*)::INTEGER FROM orders) AS orders,
          (SELECT COUNT(*)::INTEGER FROM tickets) AS tickets,
          (SELECT COUNT(*)::INTEGER FROM payment_transactions) AS payments,
          (SELECT COUNT(*)::INTEGER FROM checkin_attempts) AS checkins
      `)
    ).rows[0];

    await client.query(`
      DELETE FROM checkin_attempts;
      DELETE FROM ticket_events;
      DELETE FROM tickets;
      DELETE FROM payment_transactions;
      DELETE FROM order_events;
      DELETE FROM inventory_reservations;
      DELETE FROM orders;
      DELETE FROM admin_audit_events;
      DELETE FROM user_sessions;
    `);
    return counts;
  });
}

resetTransactionalData()
  .then((deleted) => logger.warn({ deleted }, 'Transactional ticketing data reset completed'))
  .catch((error) => {
    logger.fatal({ err: error }, 'Transactional ticketing data reset failed');
    process.exitCode = 1;
  })
  .finally(closeDatabase);
