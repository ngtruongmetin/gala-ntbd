const express = require('express');
const controller = require('./controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireCsrf } = require('../../middlewares/csrf');
const { orderRateLimiter, lookupRateLimiter } = require('../../middlewares/rate-limiters');

const ordersRouter = express.Router();

ordersRouter.post('/', orderRateLimiter, requireAuth, requireCsrf, controller.create);
ordersRouter.get(
  '/:reference/payment-instructions',
  lookupRateLimiter,
  requireAuth,
  controller.getPaymentInstructions,
);
ordersRouter.get('/:reference', lookupRateLimiter, requireAuth, controller.getByReference);

module.exports = { ordersRouter };
