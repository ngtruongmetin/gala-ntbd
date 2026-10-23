const { rateLimit } = require('express-rate-limit');

function createRateLimiter({ limit, windowMs }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
      },
    },
  });
}

const apiRateLimiter = createRateLimiter({ limit: 180, windowMs: 60_000 });
const authRateLimiter = createRateLimiter({ limit: 20, windowMs: 15 * 60_000 });
const orderRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const lookupRateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const adminRateLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
const checkInRateLimiter = createRateLimiter({ limit: 240, windowMs: 60_000 });
const webhookRateLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  orderRateLimiter,
  lookupRateLimiter,
  adminRateLimiter,
  checkInRateLimiter,
  webhookRateLimiter,
};
