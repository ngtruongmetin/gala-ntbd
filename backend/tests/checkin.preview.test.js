const test = require('node:test');
const assert = require('node:assert/strict');
const checkinService = require('../src/modules/checkin/service');

test('manual preview returns ticket details without changing ticket state', async () => {
  let lookupCount = 0;
  const ticket = {
    ticket_code: 'GT-ABC123',
    buyer_name: 'NGUYEN VAN AN',
    order_code: 'DH-001',
    order_status: 'paid',
    status: 'valid',
    checked_in_at: null,
    event_name: 'Gala',
  };

  const response = await checkinService.previewManual(
    { ticketCode: ticket.ticket_code },
    {
      client: {},
      ticketsRepository: {
        findTicketByCode: async (code) => {
          lookupCount += 1;
          assert.equal(code, ticket.ticket_code);
          return ticket;
        },
      },
    },
  );

  assert.equal(lookupCount, 1);
  assert.equal(ticket.status, 'valid');
  assert.deepEqual(response, {
    result: 'success',
    ticket: {
      code: 'GT-ABC123',
      buyerName: 'NGUYEN VAN AN',
      orderReference: 'DH-001',
      status: 'valid',
      checkedInAt: null,
      eventName: 'Gala',
    },
  });
});

test('preview rejects an invalid QR without querying tickets', async () => {
  const response = await checkinService.previewQr(
    { qrToken: 'not-a-ticket-qr', source: 'camera' },
    {
      client: {},
      ticketsRepository: {
        findTicketByQr: () => assert.fail('invalid QR must not reach the database'),
      },
    },
  );

  assert.deepEqual(response, { result: 'invalid', ticket: null });
});
