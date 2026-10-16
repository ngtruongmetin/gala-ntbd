const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const pinoHttp = require('pino-http');
const { env } = require('./config/env');
const { logger } = require('./config/logger');
const { pool } = require('./database/connection');
const { apiRateLimiter } = require('./middlewares/rate-limiters');
const { errorHandler, notFoundHandler } = require('./middlewares/error-handler');
const { healthRouter } = require('./routes/health');
const { eventSettingsRouter } = require('./modules/event-settings/routes');
const { authRouter } = require('./modules/auth/routes');
const { ordersRouter } = require('./modules/orders/routes');
const { adminRouter } = require('./modules/admin/routes');
const { accountRouter } = require('./modules/account/routes');
const { checkInRouter } = require('./modules/checkin/routes');
const { webhooksRouter } = require('./modules/webhooks/routes');

const PgSession = connectPgSimple(session);

function createApp() {
  const app = express();

  if (env.isProduction) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.corsAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error('Origin is not allowed by CORS.');
        error.statusCode = 403;
        error.code = 'CORS_ORIGIN_DENIED';
        callback(error);
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    session({
      name: env.sessionCookieName,
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new PgSession({ pool, tableName: 'user_sessions' }),
      cookie: {
        httpOnly: true,
        secure: env.sessionCookieSecure,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use('/api/webhooks', webhooksRouter);
  app.use('/api', apiRateLimiter);
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/event-settings', eventSettingsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/check-in', checkInRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
