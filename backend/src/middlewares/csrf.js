const crypto = require('node:crypto');
const { AppError } = require('../utils/app-error');

function createCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function ensureCsrfToken(session) {
  session.csrfToken ||= createCsrfToken();
  return session.csrfToken;
}

function requireCsrf(request, response, next) {
  const expected = request.session.csrfToken;
  const received = request.get('x-csrf-token');

  if (!expected || !received) {
    next(new AppError(403, 'CSRF_TOKEN_INVALID', 'Yêu cầu bảo mật không hợp lệ.'));
    return;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  const matches =
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!matches) {
    next(new AppError(403, 'CSRF_TOKEN_INVALID', 'Yêu cầu bảo mật không hợp lệ.'));
    return;
  }

  next();
}

module.exports = { createCsrfToken, ensureCsrfToken, requireCsrf };
