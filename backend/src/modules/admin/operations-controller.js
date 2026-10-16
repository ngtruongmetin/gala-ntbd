const ordersService = require('../orders/service');
const ticketsService = require('../tickets/service');
const paymentsService = require('../payments/service');
const staffService = require('./staff-service');
const { listOrdersSchema, listTicketsSchema } = require('./operations-validation');
const {
  manualTransactionSchema,
  paymentReviewSchema,
  reasonSchema,
} = require('../payments/validation');
const { createStaffGrantSchema, deleteStaffGrantSchema } = require('./staff-validation');
const { parseInput } = require('../../utils/validation');

async function listOrders(request, response) {
  response.json(await ordersService.listAdminOrders(parseInput(listOrdersSchema, request.query)));
}

async function getOrder(request, response) {
  response.json({ data: await ordersService.getAdminOrder(request.params.reference) });
}

async function cancelOrder(request, response) {
  const input = parseInput(reasonSchema, request.body);
  response.json({
    data: await ordersService.cancelOrder(request.params.reference, request.session.user, {
      reason: input.reason,
    }),
  });
}

async function recordPayment(request, response) {
  const input = parseInput(manualTransactionSchema, request.body);
  response.status(201).json({
    data: await paymentsService.recordManualPayment(
      request.params.reference,
      input,
      request.session.user,
    ),
  });
}

async function resolvePayment(request, response) {
  const input = parseInput(paymentReviewSchema, request.body);
  response.json({
    data: await paymentsService.resolvePaymentReview(
      request.params.reference,
      input,
      request.session.user,
    ),
  });
}

async function requestRefund(request, response) {
  const input = parseInput(reasonSchema, request.body);
  response.json({
    data: await paymentsService.requestRefund(
      request.params.reference,
      input.reason,
      request.session.user,
    ),
  });
}

async function confirmRefund(request, response) {
  const input = parseInput(manualTransactionSchema, request.body);
  response.json({
    data: await paymentsService.confirmManualRefund(
      request.params.reference,
      input,
      request.session.user,
    ),
  });
}

async function listTickets(request, response) {
  response.json(
    await ticketsService.listAdminTickets(parseInput(listTicketsSchema, request.query)),
  );
}

async function getTicket(request, response) {
  response.json({ data: await ticketsService.getAdminTicket(request.params.code) });
}

async function voidTicket(request, response) {
  const input = parseInput(reasonSchema, request.body);
  response.json({
    data: await ticketsService.voidTicket(request.params.code, request.session.user, input.reason),
  });
}

async function reactivateTicket(request, response) {
  const input = parseInput(reasonSchema, request.body);
  response.json({
    data: await ticketsService.reactivateTicket(
      request.params.code,
      request.session.user,
      input.reason,
    ),
  });
}

async function reissueTicketQr(request, response) {
  const input = parseInput(reasonSchema, request.body);
  response.json({
    data: await ticketsService.reissueTicketQr(
      request.params.code,
      request.session.user,
      input.reason,
    ),
  });
}

async function listStaff(request, response) {
  response.json({ data: await staffService.listStaff() });
}

async function createStaffGrant(request, response) {
  const input = parseInput(createStaffGrantSchema, request.body);
  response.status(201).json({
    data: await staffService.createGrant(input, request.session.user),
  });
}

async function revokeStaffGrant(request, response) {
  const input = parseInput(deleteStaffGrantSchema, request.body);
  response.json({
    data: await staffService.revokeGrant(
      request.params.grantId,
      input.reason,
      request.session.user,
    ),
  });
}

module.exports = {
  listOrders,
  getOrder,
  cancelOrder,
  recordPayment,
  resolvePayment,
  requestRefund,
  confirmRefund,
  listTickets,
  getTicket,
  voidTicket,
  reactivateTicket,
  reissueTicketQr,
  listStaff,
  createStaffGrant,
  revokeStaffGrant,
};
