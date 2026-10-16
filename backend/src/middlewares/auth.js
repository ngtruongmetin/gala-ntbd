const { AppError } = require('../utils/app-error');

function requireAuth(request, response, next) {
  if (!request.session.user?.id) {
    next(new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập bằng Google để tiếp tục.'));
    return;
  }

  next();
}

module.exports = { requireAuth };
