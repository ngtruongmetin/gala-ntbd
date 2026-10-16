const crypto = require('node:crypto');
const { AppError } = require('../../utils/app-error');

function createReference() {
  return `GALA-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

function createTransferContent() {
  return `GALA${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function toOrderResponse(row) {
  return {
    reference: row.order_code,
    buyerName: row.buyer_name,
    buyerPhone: row.phone,
    buyerEmail: row.email,
    quantity: row.quantity,
    unitPriceVnd: Number(row.unit_price_vnd),
    totalAmountVnd: Number(row.total_amount_vnd),
    status: row.status,
    reservationExpiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reservationState: row.reservation_state,
    ticketCount: row.ticket_count,
  };
}

async function createOrder({ user, input }, dependencies = {}) {
  const repository = dependencies.repository ?? require('./repository');
  const paymentsEnabled =
    dependencies.paymentsEnabled ?? require('../../config/env').env.paymentsEnabled;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;

  return transaction(async (client) => {
    const settings = await repository.lockEventSettings(client);
    if (!settings) {
      throw new AppError(409, 'EVENT_NOT_CONFIGURED', 'Sự kiện chưa được cấu hình.');
    }

    const now = new Date(settings.database_now);
    if (settings.sales_status !== 'open') {
      throw new AppError(409, 'SALES_PAUSED', 'Sự kiện đang tạm dừng bán vé.');
    }
    if (now < new Date(settings.sales_start_at)) {
      throw new AppError(409, 'SALES_NOT_STARTED', 'Thời gian bán vé chưa bắt đầu.');
    }
    if (now > new Date(settings.sales_end_at)) {
      throw new AppError(409, 'SALES_ENDED', 'Thời gian bán vé đã kết thúc.');
    }
    if (
      input.quantity < settings.min_tickets_per_order ||
      input.quantity > settings.max_tickets_per_order
    ) {
      throw new AppError(
        422,
        'QUANTITY_OUT_OF_RANGE',
        `Số lượng vé phải từ ${settings.min_tickets_per_order} đến ${settings.max_tickets_per_order}.`,
      );
    }

    await repository.expirePendingReservations(client);
    const reserved = Number(await repository.getReservedQuantity(client));
    const available = settings.total_capacity - reserved;
    if (input.quantity > available) {
      throw new AppError(409, 'INSUFFICIENT_INVENTORY', 'Số vé còn lại không đủ.');
    }

    const expiresAt = new Date(now.getTime() + settings.reservation_minutes * 60_000);
    let row = await repository.insertOrder(client, {
      reference: createReference(),
      userId: user.id,
      fullName: input.fullName,
      phone: input.phone,
      email: user.email,
      quantity: input.quantity,
      unitPriceVnd: settings.ticket_price_vnd,
      transferContent: createTransferContent(),
      expiresAt,
    });
    await repository.insertReservation(client, row.id, input.quantity, expiresAt);
    await repository.insertOrderEvent(client, {
      orderId: row.id,
      action: 'created',
      toStatus: 'pending_payment',
      actorUserId: user.id,
    });
    if (!paymentsEnabled) {
      row = await repository.confirmOrderWithoutPayment(client, row.id);
      await require('../tickets/service').issueTicketsForPaidOrder(client, row, user.id);
      await repository.insertOrderEvent(client, {
        orderId: row.id,
        action: 'issued_without_payment',
        fromStatus: 'pending_payment',
        toStatus: 'paid',
        actorUserId: user.id,
        reason: 'Payment integration is disabled',
      });
      return toOrderResponse({
        ...row,
        reservation_state: 'consumed',
        ticket_count: row.quantity,
      });
    }
    return toOrderResponse(row);
  });
}

async function getOrder(reference, user, dependencies = {}) {
  const repository = dependencies.repository ?? require('./repository');
  await repository.expirePendingReservations(dependencies.client);
  const row = await repository.findAuthorizedOrder(reference, user.id, dependencies.client);
  if (!row) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }
  const [events, ticketRows] = await Promise.all([
    repository.getOrderEvents(row.id, dependencies.client),
    require('../tickets/repository').listTicketsForUser(user.id, dependencies.client),
  ]);
  return {
    ...toOrderResponse(row),
    events,
    tickets: ticketRows
      .filter((ticket) => ticket.order_id === row.id)
      .map((ticket) => require('../tickets/service').toTicketResponse(ticket)),
  };
}

async function getOwnedOrder(reference, user, dependencies = {}) {
  const repository = dependencies.repository ?? require('./repository');
  const ticketsRepository = dependencies.ticketsRepository ?? require('../tickets/repository');
  await repository.expirePendingReservations(dependencies.client);
  const row = await repository.findOwnedOrder(reference, user.id, dependencies.client);
  if (!row) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');

  const [events, ticketRows, ticketEvents] = await Promise.all([
    repository.getOrderEvents(row.id, dependencies.client),
    ticketsRepository.listTicketsForUser(user.id, dependencies.client),
    ticketsRepository.getTicketEventsForOrder(row.id, dependencies.client),
  ]);
  return {
    ...toOrderResponse(row),
    events,
    tickets: ticketRows
      .filter((ticket) => ticket.order_id === row.id)
      .map((ticket) =>
        require('../tickets/service').toTicketResponse(ticket, {
          includeQr: true,
          events: ticketEvents.filter((event) => event.ticket_id === ticket.id),
        }),
      ),
  };
}

async function getPaymentInstructions(reference, user, dependencies = {}) {
  const repository = dependencies.repository ?? require('./repository');
  const provider = dependencies.provider ?? require('../payments/pay2s-provider');
  const paymentConfig = dependencies.paymentConfig ?? require('../../config/env').env.pay2s;
  await repository.expirePendingReservations(dependencies.client);
  const row = await repository.findOwnedOrder(reference, user.id, dependencies.client);
  if (!row) throw new AppError(404, 'ORDER_NOT_FOUND', 'Khong tim thay don hang.');
  if (row.status !== 'pending_payment') {
    throw new AppError(409, 'ORDER_NOT_AWAITING_PAYMENT', 'Don hang khong con cho thanh toan.');
  }

  const instructions = {
    bankCode: paymentConfig.bankCode,
    accountNumber: paymentConfig.accountNumber,
    accountName: paymentConfig.accountName,
    amountVnd: Number(row.total_amount_vnd),
    transferContent: row.transfer_content,
    expiresAt: row.reservation_expires_at,
  };
  return { ...instructions, qrCode: await provider.createQrPayload(instructions) };
}

async function expireReservations(dependencies = {}) {
  const repository = dependencies.repository ?? require('./repository');
  return repository.expirePendingReservations(dependencies.client);
}

async function listUserOrders(userId) {
  await require('./repository').expirePendingReservations();
  return (await require('./repository').listOrdersForUser(userId)).map(toOrderResponse);
}

async function cancelOrder(reference, actor, options = {}, dependencies = {}) {
  const repository = dependencies.repository ?? require('./repository');
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  return transaction(async (client) => {
    const order = await repository.lockOrder(
      reference,
      client,
      options.ownerOnly ? actor.id : null,
    );
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    if (order.status !== 'pending_payment') {
      throw new AppError(409, 'ORDER_NOT_CANCELLABLE', 'Chỉ đơn đang chờ thanh toán mới được hủy.');
    }
    const reason = options.reason ?? 'Người mua hủy đơn';
    const cancelled = await repository.cancelPendingOrder(client, order.id, actor.id, reason);
    await repository.insertOrderEvent(client, {
      orderId: order.id,
      action: options.ownerOnly ? 'cancelled_by_buyer' : 'cancelled_by_admin',
      fromStatus: 'pending_payment',
      toStatus: 'cancelled',
      actorUserId: actor.id,
      reason,
    });
    return toOrderResponse({ ...order, ...cancelled, reservation_state: 'released' });
  });
}

async function listAdminOrders(filters) {
  const repository = require('./repository');
  await repository.expirePendingReservations();
  const result = await repository.listAdminOrders(filters);
  return {
    data: result.rows.map(toOrderResponse),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.pageSize),
    },
  };
}

async function getAdminOrder(reference) {
  const repository = require('./repository');
  await repository.expirePendingReservations();
  const row = await repository.lockOrder(reference, require('../../database/connection').pool);
  if (!row) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  const [events, transactions, ticketRows] = await Promise.all([
    repository.getOrderEvents(row.id),
    require('../payments/repository').listOrderTransactions(row.id),
    require('../tickets/repository').listTicketsForUser(row.user_id),
  ]);
  return {
    ...toOrderResponse(row),
    events,
    transactions: transactions.map(require('../payments/service').toTransactionResponse),
    tickets: ticketRows
      .filter((ticket) => ticket.order_id === row.id)
      .map((ticket) => require('../tickets/service').toTicketResponse(ticket)),
  };
}

module.exports = {
  createOrder,
  getOrder,
  getOwnedOrder,
  getPaymentInstructions,
  expireReservations,
  listUserOrders,
  cancelOrder,
  listAdminOrders,
  getAdminOrder,
  toOrderResponse,
};
