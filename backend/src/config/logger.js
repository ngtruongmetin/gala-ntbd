const pino = require('pino');
const { env } = require('./env');

const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  serializers: {
    req(request) {
      return {
        id: request.id,
        method: request.method,
        url: request.url?.split('?')[0],
        remoteAddress: request.remoteAddress,
      };
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'res.headers.set-cookie',
      '*.sessionId',
      '*.token',
      '*.secret',
    ],
    censor: '[redacted]',
  },
});

module.exports = { logger };
