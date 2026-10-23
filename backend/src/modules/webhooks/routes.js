const express = require('express');
const controller = require('./controller');
const { webhookRateLimiter } = require('../../middlewares/rate-limiters');

const webhooksRouter = express.Router();
webhooksRouter.post('/pay2s', webhookRateLimiter, controller.pay2s);

module.exports = { webhooksRouter };
