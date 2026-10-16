const repository = require('../payments/repository');
const ordersRepository = require('../orders/repository');
const { issueTicketsForPaidOrder } = require('../tickets/service');

function extractPaymentCode(transaction) {
  const candidates = [transaction.paymentCode, transaction.content];
  for (const candidate of candidates) {
    const match = String(candidate ?? '')
      .toUpperCase()
      .match(/(?:^|[^A-Z0-9])(GALA[A-F0-9]{12})(?=$|[^A-Z0-9])/);
    if (match) return match[1];
  }
  return null;
}

function parsePay2sDate(value) {
  const normalized = /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}+07:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function markPaid(client, order) {
  await repository.updateReservation(client, order.id, { state: 'consumed' });
  const paidOrder = await repository.updateOrderStatus(client, order.id, {
    status: 'paid',
    paidAt: new Date(),
  });
  await issueTicketsForPaidOrder(client, paidOrder);
  await ordersRepository.insertOrderEvent(client, {
    orderId: order.id,
    action: 'payment_confirmed',
    fromStatus: order.status,
    toStatus: 'paid',
    metadata: { provider: 'pay2s' },
  });
}

async function processTransaction(transaction, dependencies = {}) {
  const paymentRepository = dependencies.repository ?? repository;
  const withTransaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const accountNumber = String(
    dependencies.accountNumber ?? require('../../config/env').env.pay2s.accountNumber,
  );

  try {
    return await withTransaction(async (client) => {
      const paymentCode = extractPaymentCode(transaction);
      const accountMatches = transaction.accountNumber === accountNumber;
      const isCredit = transaction.transferType === 'IN';
      const order =
        isCredit && accountMatches && paymentCode
          ? await paymentRepository.lockOrderByTransferContent(client, paymentCode)
          : null;

      let matchStatus = 'unmatched';
      if (order) {
        const active =
          order.reservation_state === 'active' &&
          new Date(order.reservation_expires_at).getTime() > Date.now();
        if (['paid', 'refund_pending', 'refunded'].includes(order.status)) {
          matchStatus = 'ignored';
        } else if (!active) {
          matchStatus = 'late';
        } else if (transaction.transferAmount !== Number(order.total_amount_vnd)) {
          matchStatus = 'amount_mismatch';
        } else {
          matchStatus = 'matched';
        }
      }

      await paymentRepository.insertTransaction(client, {
        provider: 'pay2s',
        reference: transaction.id,
        orderId: order?.id ?? null,
        direction: isCredit ? 'credit' : 'debit',
        amountVnd: transaction.transferAmount,
        transferContent: transaction.content || paymentCode || 'N/A',
        matchStatus,
        occurredAt: parsePay2sDate(transaction.transactionDate),
        rawPayload: transaction,
        notes: accountMatches ? null : 'Receiving account did not match configuration',
      });

      if (matchStatus === 'matched') {
        await markPaid(client, order);
      } else if (order && ['late', 'amount_mismatch'].includes(matchStatus)) {
        await paymentRepository.updateOrderStatus(client, order.id, {
          status: 'payment_review',
          reviewPreviousStatus: order.status,
        });
        if (order.reservation_state === 'active') {
          await paymentRepository.updateReservation(client, order.id, { state: 'review_hold' });
        }
        await ordersRepository.insertOrderEvent(client, {
          orderId: order.id,
          action: 'payment_review_required',
          fromStatus: order.status,
          toStatus: 'payment_review',
          metadata: { provider: 'pay2s', matchStatus },
        });
      }
      return { reference: transaction.id, matchStatus, orderReference: order?.order_code ?? null };
    });
  } catch (error) {
    if (error.code === '23505') return { reference: transaction.id, matchStatus: 'duplicate' };
    throw error;
  }
}

async function processWebhook(transactions, dependencies = {}) {
  const results = [];
  // Preserve provider order when a batch contains multiple payments for the same order.
  /* eslint-disable no-await-in-loop */
  for (const transaction of transactions) {
    results.push(await processTransaction(transaction, dependencies));
  }
  /* eslint-enable no-await-in-loop */
  return results;
}

module.exports = { extractPaymentCode, parsePay2sDate, processTransaction, processWebhook };
