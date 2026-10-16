const crypto = require('node:crypto');
const repository = require('./repository');
const { issueQrPayload } = require('./qr');
const { AppError } = require('../../utils/app-error');

function createTicketCode() {
  return `GT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function toTicketResponse(row, { includeQr = false, events = undefined } = {}) {
  const mayShowQr = includeQr && row.status === 'valid';
  return {
    code: row.ticket_code,
    orderReference: row.order_code,
    sequenceNumber: row.sequence_number,
    status: row.status,
    buyerName: row.buyer_name,
    buyerEmail: row.email,
    eventName: row.event_name,
    eventStartsAt: row.event_starts_at,
    venue: row.venue,
    issuedAt: row.issued_at,
    checkedInAt: row.checked_in_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    refundedAt: row.refunded_at,
    qrPayload: mayShowQr ? row.qr_payload : null,
    ...(events ? { events } : {}),
  };
}

async function issueTicketsForPaidOrder(client, order, actorUserId = null, dependencies = {}) {
  const ticketRepository = dependencies.repository ?? repository;
  const existingCount = await ticketRepository.countTicketsForOrder(client, order.id);
  if (existingCount === order.quantity) return [];
  if (existingCount !== 0) {
    throw new AppError(
      409,
      'TICKET_ISSUANCE_INCONSISTENT',
      'Số vé đã phát hành không khớp đơn hàng.',
    );
  }

  const tickets = Array.from({ length: order.quantity }, (_, index) => {
    const id = crypto.randomUUID();
    const qr = issueQrPayload(id);
    return {
      id,
      orderId: order.id,
      ticketCode: createTicketCode(),
      sequenceNumber: index + 1,
      qrPayload: qr.payload,
      qrHash: qr.hash,
      qrKeyId: qr.keyId,
      qrVersion: qr.version,
      qrIssuedAt: qr.issuedAt,
    };
  });
  const inserted = await ticketRepository.insertTickets(client, tickets);
  await ticketRepository.insertTicketEvents(
    client,
    inserted.map((ticket) => ({
      ticketId: ticket.id,
      action: 'issued',
      toStatus: 'valid',
      actorUserId,
    })),
  );
  return inserted;
}

async function listUserTickets(userId) {
  return (await repository.listTicketsForUser(userId)).map((row) =>
    toTicketResponse(row, { includeQr: true }),
  );
}

async function getUserTicket(ticketCode, userId) {
  const row = await repository.findTicketForUser(ticketCode, userId);
  if (!row) throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
  const events = await repository.getTicketEvents(row.id);
  return toTicketResponse(row, { includeQr: true, events });
}

async function reissueTicketQr(ticketCode, actor, reason, dependencies = {}) {
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const ticketRepository = dependencies.repository ?? repository;
  return transaction(async (client) => {
    const ticket = await ticketRepository.findTicketByCode(ticketCode, client, true);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    if (ticket.status !== 'valid') {
      throw new AppError(409, 'TICKET_NOT_VALID', 'Chỉ vé còn hiệu lực mới được cấp lại QR.');
    }
    if (ticket.order_status !== 'paid') {
      throw new AppError(409, 'ORDER_NOT_PAID', 'Đơn hàng không ở trạng thái đã thanh toán.');
    }
    const qr = issueQrPayload(ticket.id);
    const updated = await ticketRepository.updateTicketQr(client, ticket.id, qr);
    await ticketRepository.insertTicketEvents(client, [
      {
        ticketId: ticket.id,
        action: 'qr_reissued',
        fromStatus: 'valid',
        toStatus: 'valid',
        actorUserId: actor.id,
        reason,
      },
    ]);
    return toTicketResponse({ ...ticket, ...updated }, { includeQr: true });
  });
}

async function voidTicket(ticketCode, actor, reason, dependencies = {}) {
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const ticketRepository = dependencies.repository ?? repository;
  return transaction(async (client) => {
    const ticket = await ticketRepository.findTicketByCode(ticketCode, client, true);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    if (ticket.status === 'checked_in') {
      throw new AppError(409, 'TICKET_CHECKED_IN', 'Phải hoàn tác check-in trước khi thu hồi vé.');
    }
    if (ticket.status !== 'valid') {
      throw new AppError(409, 'TICKET_NOT_VALID', 'Vé không còn hiệu lực.');
    }
    const updated = await ticketRepository.updateTicketState(client, ticket.id, {
      status: 'void',
      voidedAt: new Date(),
      voidedBy: actor.id,
      voidReason: reason,
    });
    await ticketRepository.insertTicketEvents(client, [
      {
        ticketId: ticket.id,
        action: 'voided',
        fromStatus: 'valid',
        toStatus: 'void',
        actorUserId: actor.id,
        reason,
      },
    ]);
    return toTicketResponse({ ...ticket, ...updated });
  });
}

async function reactivateTicket(ticketCode, actor, reason, dependencies = {}) {
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const ticketRepository = dependencies.repository ?? repository;
  return transaction(async (client) => {
    const ticket = await ticketRepository.findTicketByCode(ticketCode, client, true);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    if (ticket.status !== 'void') {
      throw new AppError(409, 'TICKET_NOT_VOID', 'Chỉ vé đã thu hồi mới được kích hoạt lại.');
    }
    if (ticket.order_status !== 'paid') {
      throw new AppError(409, 'ORDER_NOT_PAID', 'Không thể kích hoạt vé khi đơn đang hoàn tiền.');
    }
    await ticketRepository.updateTicketState(client, ticket.id, { status: 'valid' });
    const qr = issueQrPayload(ticket.id);
    const updated = await ticketRepository.updateTicketQr(client, ticket.id, qr);
    await ticketRepository.insertTicketEvents(client, [
      {
        ticketId: ticket.id,
        action: 'reactivated',
        fromStatus: 'void',
        toStatus: 'valid',
        actorUserId: actor.id,
        reason,
      },
    ]);
    return toTicketResponse(
      {
        ...ticket,
        ...updated,
        status: 'valid',
        voided_at: null,
        void_reason: null,
      },
      { includeQr: true },
    );
  });
}

async function listAdminTickets(filters) {
  const result = await repository.listAdminTickets(filters);
  return {
    data: result.rows.map((row) => toTicketResponse(row)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.pageSize),
    },
  };
}

async function getAdminTicket(ticketCode) {
  const row = await repository.findTicketByCode(ticketCode);
  if (!row) throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
  const events = await repository.getTicketEvents(row.id);
  return toTicketResponse(row, { events });
}

module.exports = {
  issueTicketsForPaidOrder,
  listUserTickets,
  getUserTicket,
  reissueTicketQr,
  voidTicket,
  reactivateTicket,
  listAdminTickets,
  getAdminTicket,
  toTicketResponse,
};
