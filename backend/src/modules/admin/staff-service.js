const { env } = require('../../config/env');
const repository = require('./repository');
const { AppError } = require('../../utils/app-error');

async function listStaff() {
  const result = await repository.listStaff(env.adminEmails);
  return {
    bootstrapSuperAdmins: result.bootstrapSuperAdmins,
    grants: result.grants.map((grant) => ({
      id: grant.id,
      email: grant.email,
      role: grant.role,
      active: grant.active,
      displayName: grant.display_name,
      createdAt: grant.created_at,
    })),
  };
}

async function createGrant(input, actor, dependencies = {}) {
  if (env.adminEmails.includes(input.email)) {
    throw new AppError(409, 'BOOTSTRAP_ADMIN_IMMUTABLE', 'Email này đã là chủ hệ thống.');
  }
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const staffRepository = dependencies.repository ?? repository;
  try {
    return await transaction(async (client) => {
      const grant = await staffRepository.createStaffGrant(client, {
        ...input,
        createdBy: actor.id,
      });
      await staffRepository.insertAdminAudit(client, {
        actorUserId: actor.id,
        action: 'staff_role_granted',
        entityType: 'staff_grant',
        entityId: grant.id,
        metadata: { role: grant.role },
      });
      return grant;
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'STAFF_GRANT_EXISTS', 'Quyền này đã được cấp cho email.');
    }
    throw error;
  }
}

async function revokeGrant(grantId, reason, actor, dependencies = {}) {
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const staffRepository = dependencies.repository ?? repository;
  return transaction(async (client) => {
    const grant = await staffRepository.deleteStaffGrant(client, grantId);
    if (!grant) throw new AppError(404, 'STAFF_GRANT_NOT_FOUND', 'Không tìm thấy quyền nhân sự.');
    await staffRepository.insertAdminAudit(client, {
      actorUserId: actor.id,
      action: 'staff_role_revoked',
      entityType: 'staff_grant',
      entityId: grant.id,
      reason,
      metadata: { role: grant.role },
    });
    return { revoked: true };
  });
}

module.exports = { listStaff, createGrant, revokeGrant };
