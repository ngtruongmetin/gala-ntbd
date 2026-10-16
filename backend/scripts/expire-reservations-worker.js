const { expireReservations } = require('../src/modules/orders/service');
const { closeDatabase } = require('../src/database/connection');
const { env } = require('../src/config/env');
const { logger } = require('../src/config/logger');

let stopping = false;
let sweepRunning = false;
let currentSweep = Promise.resolve();

function sweep() {
  if (stopping || sweepRunning) return;
  sweepRunning = true;
  currentSweep = expireReservations()
    .then((expiredCount) => {
      if (expiredCount > 0) logger.info({ expiredCount }, 'Expired pending reservations');
    })
    .catch((error) => logger.error({ err: error }, 'Reservation expiration sweep failed'))
    .finally(() => {
      sweepRunning = false;
    });
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  logger.info({ signal }, 'Stopping reservation expiration worker');
  await currentSweep;
  await closeDatabase();
  process.exit(0);
}

logger.info(
  { intervalSeconds: env.expirationSweepSeconds },
  'Reservation expiration worker started',
);
sweep();
const timer = setInterval(sweep, env.expirationSweepSeconds * 1_000);

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
