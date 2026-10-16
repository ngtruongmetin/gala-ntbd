const express = require('express');
const controller = require('./controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireAdmin } = require('../../middlewares/admin');
const { requireCsrf } = require('../../middlewares/csrf');
const { adminRateLimiter } = require('../../middlewares/rate-limiters');
const { requireSuperAdmin } = require('../../middlewares/checkin');
const operations = require('./operations-controller');
const multer = require('multer');

const partnerLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype));
  },
}).single('logo');

const adminRouter = express.Router();

adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/dashboard', adminRateLimiter, controller.getDashboard);
adminRouter.put('/event-settings', adminRateLimiter, requireCsrf, controller.updateEventSettings);
adminRouter.post(
  '/partners',
  adminRateLimiter,
  requireCsrf,
  partnerLogoUpload,
  controller.createPartner,
);
adminRouter.put(
  '/partners/:id',
  adminRateLimiter,
  requireCsrf,
  partnerLogoUpload,
  controller.updatePartner,
);
adminRouter.delete('/partners/:id', adminRateLimiter, requireCsrf, controller.deletePartner);
adminRouter.get('/orders', adminRateLimiter, operations.listOrders);
adminRouter.get('/orders/:reference', adminRateLimiter, operations.getOrder);
adminRouter.post(
  '/orders/:reference/cancel',
  adminRateLimiter,
  requireCsrf,
  operations.cancelOrder,
);
adminRouter.post(
  '/orders/:reference/payments/manual',
  adminRateLimiter,
  requireCsrf,
  operations.recordPayment,
);
adminRouter.post(
  '/orders/:reference/payment-review/resolve',
  adminRateLimiter,
  requireCsrf,
  operations.resolvePayment,
);
adminRouter.post(
  '/orders/:reference/refund-request',
  adminRateLimiter,
  requireCsrf,
  operations.requestRefund,
);
adminRouter.post(
  '/orders/:reference/refunds/manual',
  adminRateLimiter,
  requireCsrf,
  operations.confirmRefund,
);
adminRouter.get('/tickets', adminRateLimiter, operations.listTickets);
adminRouter.get('/tickets/:code', adminRateLimiter, operations.getTicket);
adminRouter.post('/tickets/:code/void', adminRateLimiter, requireCsrf, operations.voidTicket);
adminRouter.post(
  '/tickets/:code/reactivate',
  adminRateLimiter,
  requireCsrf,
  operations.reactivateTicket,
);
adminRouter.post(
  '/tickets/:code/reissue-qr',
  adminRateLimiter,
  requireCsrf,
  operations.reissueTicketQr,
);
adminRouter.get('/staff', adminRateLimiter, requireSuperAdmin, operations.listStaff);
adminRouter.post(
  '/staff',
  adminRateLimiter,
  requireSuperAdmin,
  requireCsrf,
  operations.createStaffGrant,
);
adminRouter.delete(
  '/staff/:grantId',
  adminRateLimiter,
  requireSuperAdmin,
  requireCsrf,
  operations.revokeStaffGrant,
);

module.exports = { adminRouter };
