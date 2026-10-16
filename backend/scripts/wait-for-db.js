const { checkDatabase, closeDatabase } = require('../src/database/connection');
const { logger } = require('../src/config/logger');

/* eslint-disable no-await-in-loop -- Readiness checks must wait before the next retry. */

const maxAttempts = 30;
const retryDelayMs = 2_000;

async function wait() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await checkDatabase();
      logger.info('Database is ready');
      await closeDatabase();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      logger.warn({ attempt, maxAttempts }, 'Database is not ready yet');
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

wait().catch(async (error) => {
  logger.fatal({ err: error }, 'Database did not become ready');
  await closeDatabase();
  process.exitCode = 1;
});
