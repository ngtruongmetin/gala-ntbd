const repository = require('./repository');
const { parseGoogleClaims } = require('./validation');
const { AppError } = require('../../utils/app-error');
const { env } = require('../../config/env');

async function authenticateGoogleClaims(rawClaims, dependencies = {}) {
  const authRepository = dependencies.authRepository ?? repository;
  const adminRepository = dependencies.adminRepository ?? require('../admin/repository');
  const parsed = parseGoogleClaims(rawClaims);
  const user = await authRepository.upsertGoogleUser(parsed);

  if (!user) {
    throw new AppError(500, 'AUTH_USER_SAVE_FAILED', 'Không thể lưu tài khoản Google.');
  }

  await adminRepository.syncConfiguredAdmin(user.id, user.email, env.adminEmails);
  const roles = await adminRepository.getUserRoles(user.id);

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    roles,
  };
}

module.exports = { authenticateGoogleClaims };
