const repository = require('./repository');
const ticketsRepository = require('../tickets/repository');
const { decryptQrPayload } = require('../tickets/qr');
const { AppError } = require('../../utils/app-error');

function toCheckInResponse(result, ticket = null) {
  return {
    result,
    ticket: ticket
      ? {
          code: ticket.ticket_code,
          buyerName: ticket.buyer_name,
          orderReference: ticket.order_code,
          status: ticket.status,
          checkedInAt: ticket.checked_in_at,
          eventName: ticket.event_name,
        }
      : null,
  };
}

function resultForTicket(ticket) {
  if (!ticket) return 'invalid';
  if (ticket.status === 'checked_in') return 'already_checked_in';
  if (ticket.status === 'void') return 'revoked';
  if (ticket.status === 'refunded') return 'refunded';
  if (ticket.order_status !== 'paid') return 'unpaid';
  return 'success';
}

async function previewQr(input, dependencies = {}) {
  const client = dependencies.client ?? require('../../database/connection').pool;
  const ticketRepository = dependencies.ticketsRepository ?? ticketsRepository;
  let decoded;
  try {
    decoded = decryptQrPayload(input.qrToken);
  } catch {
    return toCheckInResponse('invalid');
  }
  const ticket = await ticketRepository.findTicketByQr(decoded.tid, decoded.hash, client, false);
  return toCheckInResponse(resultForTicket(ticket), ticket);
}

async function previewManual(input, dependencies = {}) {
  const client = dependencies.client ?? require('../../database/connection').pool;
  const ticketRepository = dependencies.ticketsRepository ?? ticketsRepository;
  const ticket = await ticketRepository.findTicketByCode(input.ticketCode, client);
  return toCheckInResponse(resultForTicket(ticket), ticket);
}

async function persistResult(client, input, operator, ticket, result, checkinRepository) {
  const attempt = await checkinRepository.insertAttempt(client, {
    requestId: input.requestId,
    ticketId: ticket?.id,
    operatorUserId: operator.id,
    source: input.source,
    result,
  });
  if (!attempt) {
    const existing = await checkinRepository.findAttempt(input.requestId, client);
    return toCheckInResponse(existing.result, existing);
  }
  return toCheckInResponse(result, ticket);
}

async function scanTicket(input, operator, dependencies = {}) {
  const checkinRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const existing = await checkinRepository.findAttempt(input.requestId, dependencies.client);
  if (existing) return toCheckInResponse(existing.result, existing);

  let decoded;
  try {
    decoded = decryptQrPayload(input.qrToken);
  } catch {
    return transaction((client) =>
      persistResult(client, input, operator, null, 'invalid', checkinRepository),
    );
  }

  return transaction(async (client) => {
    const duplicate = await checkinRepository.findAttempt(input.requestId, client);
    if (duplicate) return toCheckInResponse(duplicate.result, duplicate);
    const ticket = await ticketsRepository.findTicketByQr(decoded.tid, decoded.hash, client);
    const result = resultForTicket(ticket);
    if (result !== 'success') {
      return persistResult(client, input, operator, ticket, result, checkinRepository);
    }
    const updated = await checkinRepository.markCheckedIn(client, ticket.id, operator.id);
    await ticketsRepository.insertTicketEvents(client, [
      {
        ticketId: ticket.id,
        action: 'checked_in',
        fromStatus: 'valid',
        toStatus: 'checked_in',
        actorUserId: operator.id,
      },
    ]);
    return persistResult(
      client,
      input,
      operator,
      { ...ticket, ...updated },
      'success',
      checkinRepository,
    );
  });
}

async function manualCheckIn(input, operator, dependencies = {}) {
  const checkinRepository = dependencies.repository ?? repository;
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  const existing = await checkinRepository.findAttempt(input.requestId, dependencies.client);
  if (existing) return toCheckInResponse(existing.result, existing);
  return transaction(async (client) => {
    const ticket = await ticketsRepository.findTicketByCode(input.ticketCode, client, true);
    const result = resultForTicket(ticket);
    const normalizedInput = { ...input, source: 'manual' };
    if (result !== 'success') {
      return persistResult(client, normalizedInput, operator, ticket, result, checkinRepository);
    }
    const updated = await checkinRepository.markCheckedIn(client, ticket.id, operator.id);
    await ticketsRepository.insertTicketEvents(client, [
      {
        ticketId: ticket.id,
        action: 'checked_in_manual',
        fromStatus: 'valid',
        toStatus: 'checked_in',
        actorUserId: operator.id,
      },
    ]);
    return persistResult(
      client,
      normalizedInput,
      operator,
      { ...ticket, ...updated },
      'success',
      checkinRepository,
    );
  });
}

async function undoCheckIn(ticketCode, reason, actor, dependencies = {}) {
  const transaction =
    dependencies.withTransaction ?? require('../../database/connection').withTransaction;
  return transaction(async (client) => {
    const ticket = await ticketsRepository.findTicketByCode(ticketCode, client, true);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Không tìm thấy vé.');
    if (ticket.status !== 'checked_in') {
      throw new AppError(409, 'TICKET_NOT_CHECKED_IN', 'Vé chưa được check-in.');
    }
    const updated = await ticketsRepository.updateTicketState(client, ticket.id, {
      status: 'valid',
    });
    await ticketsRepository.insertTicketEvents(client, [
      {
        ticketId: ticket.id,
        action: 'checkin_undone',
        fromStatus: 'checked_in',
        toStatus: 'valid',
        actorUserId: actor.id,
        reason,
      },
    ]);
    return toCheckInResponse('undone', { ...ticket, ...updated, status: 'valid' });
  });
}

module.exports = { previewQr, previewManual, scanTicket, manualCheckIn, undoCheckIn };
