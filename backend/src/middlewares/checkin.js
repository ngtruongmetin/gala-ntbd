const { AppError } = require('../utils/app-error');
const repository = require('../modules/admin/repository');

function requireCheckIn(request, response, next) {
  repository
    .hasCheckInPermission(request.session.user.id)
    .then((allowed) => {
      if (!allowed) {
        next(new AppError(403, 'CHECKIN_REQUIRED', 'Bạn không có quyền check-in.'));
        return;
      }
      next();
    })
    .catch(next);
}

function requireSuperAdmin(request, response, next) {
  repository
    .hasSuperAdminPermission(request.session.user.id)
    .then((allowed) => {
      if (!allowed) {
        next(new AppError(403, 'SUPER_ADMIN_REQUIRED', 'Bạn không có quyền quản lý nhân sự.'));
        return;
      }
      next();
    })
    .catch(next);
}

module.exports = { requireCheckIn, requireSuperAdmin };
