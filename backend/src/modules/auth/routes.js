const express = require('express');
const controller = require('./controller');
const { authRateLimiter } = require('../../middlewares/rate-limiters');
const { requireAuth } = require('../../middlewares/auth');
const { requireCsrf } = require('../../middlewares/csrf');

const authRouter = express.Router();

authRouter.get('/me', controller.getCurrentUser);
authRouter.get('/google', authRateLimiter, controller.startGoogleLogin);
authRouter.get('/google/callback', authRateLimiter, controller.handleGoogleCallback);
authRouter.post('/logout', requireAuth, requireCsrf, controller.logout);

module.exports = { authRouter };
