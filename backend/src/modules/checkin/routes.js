const express = require('express');
const controller = require('./controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireCsrf } = require('../../middlewares/csrf');
const { requireCheckIn } = require('../../middlewares/checkin');
const { requireAdmin } = require('../../middlewares/admin');
const { checkInRateLimiter } = require('../../middlewares/rate-limiters');

const checkInRouter = express.Router();

checkInRouter.use(requireAuth, requireCsrf, checkInRateLimiter);
checkInRouter.post('/preview/scan', requireCheckIn, controller.previewScan);
checkInRouter.post('/preview/manual', requireCheckIn, controller.previewManual);
checkInRouter.post('/scan', requireCheckIn, controller.scan);
checkInRouter.post('/manual', requireCheckIn, controller.manual);
checkInRouter.post('/tickets/:ticketCode/undo', requireAdmin, controller.undo);

module.exports = { checkInRouter };
