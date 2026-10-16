const { createApp } = require('./app');
const { env } = require('./config/env');
const { logger } = require('./config/logger');
const { checkDatabase, closeDatabase } = require('./database/connection');

async function startServer() {
  await checkDatabase();

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info({ port: env.port }, 'Gala Ticketing API is listening');
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  logger.fatal({ err: error }, 'Unable to start server');
  process.exit(1);
});
