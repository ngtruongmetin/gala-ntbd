const express = require('express');
const controller = require('./controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireCsrf } = require('../../middlewares/csrf');
const { lookupRateLimiter, orderRateLimiter } = require('../../middlewares/rate-limiters');

const accountRouter = express.Router();

accountRouter.use(requireAuth);
accountRouter.get('/orders', lookupRateLimiter, controller.listOrders);
accountRouter.get('/orders/:reference', lookupRateLimiter, controller.getOrder);
accountRouter.post(
  '/orders/:reference/cancel',
  orderRateLimiter,
  requireCsrf,
  controller.cancelOrder,
);
accountRouter.get('/tickets', lookupRateLimiter, controller.listTickets);
accountRouter.get('/tickets/:code', lookupRateLimiter, controller.getTicket);

module.exports = { accountRouter };
