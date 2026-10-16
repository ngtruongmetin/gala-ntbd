const { env } = require('../../config/env');
const repository = require('./repository');
const eventSettingsService = require('../event-settings/service');
const eventSettingsRepository = require('../event-settings/repository');
const { AppError } = require('../../utils/app-error');

async function getDashboard(dependencies = {}) {
  const adminRepository = dependencies.repository ?? repository;
  const settings = await eventSettingsService.getPublicEventSettings();
  if (!settings) {
    throw new AppError(404, 'EVENT_NOT_CONFIGURED', 'Sự kiện chưa được cấu hình.');
  }
  const [dashboard, partnerRows] = await Promise.all([
    adminRepository.getAdminDashboard(),
    adminRepository.listPartners(),
  ]);
  return {
    settings,
    summary: {
      pendingOrders: dashboard.summary.pending_orders,
      paidOrders: dashboard.summary.paid_orders,
      reviewOrders: dashboard.summary.review_orders,
      refundPendingOrders: dashboard.summary.refund_pending_orders,
      expiredOrders: dashboard.summary.expired_orders,
      reservedTickets: dashboard.summary.reserved_tickets,
      soldTickets: dashboard.summary.sold_tickets,
      validTickets: dashboard.summary.valid_tickets,
      checkedInTickets: dashboard.summary.checked_in_tickets,
      voidTickets: dashboard.summary.void_tickets,
      refundedTickets: dashboard.summary.refunded_tickets,
      grossRevenueVnd: Number(dashboard.summary.gross_revenue_vnd),
      refundedRevenueVnd: Number(dashboard.summary.refunded_revenue_vnd),
      netRevenueVnd:
        Number(dashboard.summary.gross_revenue_vnd) -
        Number(dashboard.summary.refunded_revenue_vnd),
    },
    trend: dashboard.trend.map((point) => ({
      day: point.day,
      orders: point.orders,
      revenueVnd: Number(point.revenue_vnd),
    })),
    reviewOrders: dashboard.reviewOrders.map((order) => ({
      reference: order.order_code,
      buyerName: order.buyer_name,
      totalAmountVnd: Number(order.total_amount_vnd),
      updatedAt: order.updated_at,
    })),
    recentCheckIns: dashboard.recentCheckIns.map((attempt) => ({
      result: attempt.result,
      occurredAt: attempt.occurred_at,
      ticketCode: attempt.ticket_code,
      operatorEmail: attempt.operator_email,
    })),
    configuredAdminEmails: env.adminEmails,
    activeAdminEmails: dashboard.activeAdminEmails,
    partners: partnerRows.map(eventSettingsService.toPartner),
  };
}

async function updateEventSettings(input, actor = null, dependencies = {}) {
  const adminRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;

  return transaction(async (client) => {
    const current = await adminRepository.lockEventSettings(client);
    if (!current) {
      throw new AppError(404, 'EVENT_NOT_CONFIGURED', 'Sự kiện chưa được cấu hình.');
    }
    const reservedQuantity = Number(await adminRepository.getReservedQuantity(client));
    if (input.totalCapacity < reservedQuantity) {
      throw new AppError(
        409,
        'CAPACITY_BELOW_RESERVED',
        `Tổng số vé không thể thấp hơn ${reservedQuantity} vé đã bán hoặc đang giữ.`,
      );
    }

    await adminRepository.updateEventSettings(client, input);
    await adminRepository.insertAdminAudit(client, {
      actorUserId: actor?.id ?? null,
      action: 'event_settings_updated',
      entityType: 'event_settings',
      entityId: current.id,
      metadata: {
        salesStatus: input.salesStatus,
        ticketPriceVnd: input.ticketPriceVnd,
        totalCapacity: input.totalCapacity,
      },
    });
    const updated = await eventSettingsRepository.findCurrentEventSettings(client);
    return eventSettingsService.toPublicEventSettings(updated);
  });
}

async function createPartner(input, actor, dependencies = {}) {
  return mutatePartner('created', null, input, actor, dependencies);
}

async function updatePartner(id, input, actor, dependencies = {}) {
  return mutatePartner('updated', id, input, actor, dependencies);
}

async function mutatePartner(action, id, input, actor, dependencies) {
  const adminRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  return transaction(async (client) => {
    const row = id
      ? await adminRepository.updatePartner(client, id, input)
      : await adminRepository.createPartner(client, input);
    if (!row) throw new AppError(404, 'PARTNER_NOT_FOUND', 'Không tìm thấy đơn vị đồng hành.');
    await adminRepository.insertAdminAudit(client, {
      actorUserId: actor.id,
      action: `event_partner_${action}`,
      entityType: 'event_partner',
      entityId: row.id,
      metadata: { name: row.name },
    });
    return eventSettingsService.toPartner(row);
  });
}

async function deletePartner(id, actor, dependencies = {}) {
  const adminRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  return transaction(async (client) => {
    const row = await adminRepository.deletePartner(client, id);
    if (!row) throw new AppError(404, 'PARTNER_NOT_FOUND', 'Không tìm thấy đơn vị đồng hành.');
    await adminRepository.insertAdminAudit(client, {
      actorUserId: actor.id,
      action: 'event_partner_deleted',
      entityType: 'event_partner',
      entityId: row.id,
      metadata: { name: row.name },
    });
    return { id: row.id };
  });
}

module.exports = { getDashboard, updateEventSettings, createPartner, updatePartner, deletePartner };
