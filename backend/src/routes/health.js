const express = require('express');
const { checkDatabase } = require('../database/connection');

const healthRouter = express.Router();

healthRouter.get('/', (request, response) => {
  checkDatabase()
    .then(() => {
      response.json({ status: 'ok', database: 'connected' });
    })
    .catch((error) => {
      request.log.error({ err: error }, 'Database health check failed');
      response.status(503).json({ status: 'degraded', database: 'unavailable' });
    });
});

module.exports = { healthRouter };
