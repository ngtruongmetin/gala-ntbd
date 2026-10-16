const repository = require('./repository');
const ordersRepository = require('../orders/repository');
const ticketsRepository = require('../tickets/repository');
const { issueTicketsForPaidOrder } = require('../tickets/service');
const { AppError } = require('../../utils/app-error');

function toTransactionResponse(row) {
  return {
    id: row.id,
    provider: row.provider,
    reference: row.provider_transaction_id,
    direction: row.direction,
    amountVnd: Number(row.amount_vnd),
    matchStatus: row.match_status,
    occurredAt: row.occurred_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

async function ensureCapacityForReleasedReservation(client, order, paymentRepository) {
  const settings = await ordersRepository.lockEventSettings(client);
  await ordersRepository.expirePendingReservations(client);
  const reserved = Number(await ordersRepository.getReservedQuantity(client));
  if (reserved + order.quantity > settings.total_capacity) {
    throw new AppError(
      409,
      'INSUFFICIENT_INVENTORY',
      'Không còn đủ vé để nhận giao dịch đến muộn.',
    );
  }
  await paymentRepository.updateReservation(client, order.id, { state: 'consumed' });
}

async function markPaid(client, order, actorId, paymentRepository) {
  if (order.reservation_state === 'released') {
    await ensureCapacityForReleasedReservation(client, order, paymentRepository);
  } else {
    await paymentRepository.updateReservation(client, order.id, { state: 'consumed' });
  }
  const paidOrder = await paymentRepository.updateOrderStatus(client, order.id, {
    status: 'paid',
    paidAt: new Date(),
  });
  await issueTicketsForPaidOrder(client, paidOrder, actorId);
  await ordersRepository.insertOrderEvent(client, {
    orderId: order.id,
    action: 'payment_confirmed',
    fromStatus: order.status,
    toStatus: 'paid',
    actorUserId: actorId,
  });
  return paidOrder;
}

async function recordManualPayment(reference, input, actor, dependencies = {}) {
  const paymentRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;

  try {
    return await transaction(async (client) => {
      const order = await paymentRepository.lockOrderByReference(client, reference);
      if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (['paid', 'refund_pending', 'refunded'].includes(order.status)) {
        throw new AppError(409, 'ORDER_ALREADY_PAID', 'Đơn hàng đã được xác nhận thanh toán.');
      }

      const active =
        order.reservation_state === 'active' &&
        new Date(order.reservation_expires_at).getTime() > Date.now();
      const exactAmount = input.amountVnd === Number(order.total_amount_vnd);
      const matchStatus = active ? (exactAmount ? 'matched' : 'amount_mismatch') : 'late';
      const payment = await paymentRepository.insertTransaction(client, {
        provider: 'manual_bank_transfer',
        reference: input.transactionReference,
        orderId: order.id,
        direction: 'credit',
        amountVnd: input.amountVnd,
        transferContent: order.transfer_content ?? order.order_code,
        matchStatus,
        occurredAt: input.occurredAt,
        rawPayload: { source: 'admin_manual' },
        recordedBy: actor.id,
        notes: input.notes,
      });

      if (matchStatus === 'matched') {
        await markPaid(client, order, actor.id, paymentRepository);
      } else {
        await paymentRepository.updateOrderStatus(client, order.id, {
          status: 'payment_review',
          reviewPreviousStatus: order.status,
        });
        if (active) {
          await paymentRepository.updateReservation(client, order.id, { state: 'review_hold' });
        }
        await ordersRepository.insertOrderEvent(client, {
          orderId: order.id,
          action: 'payment_review_required',
          fromStatus: order.status,
          toStatus: 'payment_review',
          actorUserId: actor.id,
          metadata: { matchStatus },
        });
      }
      return {
        transaction: toTransactionResponse(payment),
        orderStatus: matchStatus === 'matched' ? 'paid' : 'payment_review',
      };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'PAYMENT_TRANSACTION_DUPLICATE', 'Mã giao dịch đã được ghi nhận.');
    }
    throw error;
  }
}

async function resolvePaymentReview(reference, input, actor, dependencies = {}) {
  const paymentRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  return transaction(async (client) => {
    const order = await paymentRepository.lockOrderByReference(client, reference);
    if (!order || order.status !== 'payment_review') {
      throw new AppError(409, 'ORDER_NOT_IN_REVIEW', 'Đơn hàng không ở trạng thái đối soát.');
    }
    const payment = await paymentRepository.lockTransaction(client, input.transactionId, order.id);
    if (!payment || !['amount_mismatch', 'late'].includes(payment.match_status)) {
      throw new AppError(409, 'PAYMENT_NOT_REVIEWABLE', 'Giao dịch không thể đối soát.');
    }

    if (input.decision === 'ignore') {
      await paymentRepository.updateTransactionReview(client, payment.id, {
        matchStatus: 'ignored',
        reviewedBy: actor.id,
        reason: input.reason,
      });
      const fallbackStatus =
        order.review_previous_status === 'pending_payment'
          ? 'expired'
          : order.review_previous_status;
      await paymentRepository.updateOrderStatus(client, order.id, {
        status: fallbackStatus ?? 'expired',
      });
      await paymentRepository.updateReservation(client, order.id, {
        state: 'released',
        releasedAt: new Date(),
      });
      return { orderStatus: fallbackStatus ?? 'expired' };
    }

    await paymentRepository.updateTransactionReview(client, payment.id, {
      matchStatus: 'matched',
      reviewedBy: actor.id,
      reason: input.reason,
    });
    const credited = await paymentRepository.getMatchedCreditTotal(client, order.id);
    if (credited < Number(order.total_amount_vnd)) {
      return { orderStatus: 'payment_review', creditedAmountVnd: credited };
    }
    await markPaid(client, order, actor.id, paymentRepository);
    return { orderStatus: 'paid', creditedAmountVnd: credited };
  });
}

async function requestRefund(reference, reason, actor, dependencies = {}) {
  const paymentRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  return transaction(async (client) => {
    const order = await paymentRepository.lockOrderByReference(client, reference);
    if (!order || order.status !== 'paid') {
      throw new AppError(
        409,
        'ORDER_NOT_REFUNDABLE',
        'Chỉ đơn đã thanh toán mới có thể yêu cầu hoàn tiền.',
      );
    }
    if ((await paymentRepository.countCheckedInTickets(client, order.id)) > 0) {
      throw new AppError(
        409,
        'CHECKED_IN_TICKETS_EXIST',
        'Phải hoàn tác check-in trước khi hoàn tiền.',
      );
    }
    const voided = await paymentRepository.voidOrderTickets(client, order.id, actor.id, reason);
    await ticketsRepository.insertTicketEvents(
      client,
      voided.map((ticket) => ({
        ticketId: ticket.id,
        action: 'refund_requested',
        fromStatus: 'valid',
        toStatus: 'void',
        actorUserId: actor.id,
        reason,
      })),
    );
    await paymentRepository.updateOrderStatus(client, order.id, {
      status: 'refund_pending',
      refundRequestedAt: new Date(),
      refundRequestedBy: actor.id,
      refundReason: reason,
    });
    await ordersRepository.insertOrderEvent(client, {
      orderId: order.id,
      action: 'refund_requested',
      fromStatus: 'paid',
      toStatus: 'refund_pending',
      actorUserId: actor.id,
      reason,
    });
    return { orderStatus: 'refund_pending' };
  });
}

async function confirmManualRefund(reference, input, actor, dependencies = {}) {
  const paymentRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  try {
    return await transaction(async (client) => {
      const order = await paymentRepository.lockOrderByReference(client, reference);
      if (!order || order.status !== 'refund_pending') {
        throw new AppError(409, 'ORDER_NOT_REFUND_PENDING', 'Đơn hàng không chờ hoàn tiền.');
      }
      if (input.amountVnd !== Number(order.total_amount_vnd)) {
        throw new AppError(
          422,
          'REFUND_AMOUNT_MISMATCH',
          'Số tiền hoàn phải bằng tổng tiền đơn hàng.',
        );
      }
      const refund = await paymentRepository.insertTransaction(client, {
        provider: 'manual_bank_refund',
        reference: input.transactionReference,
        orderId: order.id,
        direction: 'debit',
        amountVnd: input.amountVnd,
        transferContent: order.order_code,
        matchStatus: 'matched',
        occurredAt: input.occurredAt,
        rawPayload: { source: 'admin_manual' },
        recordedBy: actor.id,
        notes: input.notes,
      });
      const refundedTickets = await paymentRepository.refundOrderTickets(client, order.id);
      await ticketsRepository.insertTicketEvents(
        client,
        refundedTickets.map((ticket) => ({
          ticketId: ticket.id,
          action: 'refunded',
          fromStatus: 'void',
          toStatus: 'refunded',
          actorUserId: actor.id,
        })),
      );
      await paymentRepository.updateReservation(client, order.id, {
        state: 'released',
        releasedAt: new Date(),
      });
      await paymentRepository.updateOrderStatus(client, order.id, {
        status: 'refunded',
        refundedAt: new Date(),
      });
      await ordersRepository.insertOrderEvent(client, {
        orderId: order.id,
        action: 'refund_confirmed',
        fromStatus: 'refund_pending',
        toStatus: 'refunded',
        actorUserId: actor.id,
      });
      return { transaction: toTransactionResponse(refund), orderStatus: 'refunded' };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'PAYMENT_TRANSACTION_DUPLICATE', 'Mã giao dịch đã được ghi nhận.');
    }
    throw error;
  }
}

module.exports = {
  recordManualPayment,
  resolvePaymentReview,
  requestRefund,
  confirmManualRefund,
  toTransactionResponse,
};
