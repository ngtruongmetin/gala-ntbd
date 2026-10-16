const { AppError } = require('../utils/app-error');
const repository = require('../modules/admin/repository');

function requireAdmin(request, response, next) {
  repository
    .hasAdminPermission(request.session.user.id)
    .then((isAdmin) => {
      if (!isAdmin) {
        next(new AppError(403, 'ADMIN_REQUIRED', 'Bạn không có quyền quản trị.'));
        return;
      }
      next();
    })
    .catch(next);
}

module.exports = { requireAdmin };
