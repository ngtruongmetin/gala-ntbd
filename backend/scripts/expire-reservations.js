const { expireReservations } = require('../src/modules/orders/service');
const { closeDatabase } = require('../src/database/connection');
const { logger } = require('../src/config/logger');

expireReservations()
  .then((expiredCount) => logger.info({ expiredCount }, 'Expired pending reservations'))
  .catch((error) => {
    logger.fatal({ err: error }, 'Reservation expiration failed');
    process.exitCode = 1;
  })
  .finally(closeDatabase);
