const ordersService = require('../orders/service');
const ticketsService = require('../tickets/service');
const { reasonSchema } = require('../payments/validation');
const { parseInput } = require('../../utils/validation');

async function listOrders(request, response) {
  response.json({ data: await ordersService.listUserOrders(request.session.user.id) });
}

async function getOrder(request, response) {
  response.json({
    data: await ordersService.getOwnedOrder(request.params.reference, request.session.user),
  });
}

async function cancelOrder(request, response) {
  const input = parseInput(reasonSchema, request.body, 'Lý do hủy đơn không hợp lệ.');
  response.json({
    data: await ordersService.cancelOrder(request.params.reference, request.session.user, {
      ownerOnly: true,
      reason: input.reason,
    }),
  });
}

async function listTickets(request, response) {
  response.json({ data: await ticketsService.listUserTickets(request.session.user.id) });
}

async function getTicket(request, response) {
  response.json({
    data: await ticketsService.getUserTicket(request.params.code, request.session.user.id),
  });
}

module.exports = { listOrders, getOrder, cancelOrder, listTickets, getTicket };
