const test = require('node:test');
const assert = require('node:assert/strict');
const { pay2sWebhookSchema } = require('../src/modules/webhooks/validation');
const { extractPaymentCode, parsePay2sDate } = require('../src/modules/webhooks/service');
const { tokensEqual } = require('../src/modules/webhooks/controller');
const { createQrPayload } = require('../src/modules/payments/pay2s-provider');

const sample = {
  transactions: [
    {
      id: 32756283,
      gateway: 'MB',
      transactionDate: '2026-10-03 03:43:57',
      transactionNumber: '24936',
      accountNumber: '0123456789',
      content: 'THANH TOAN GALA7F3A91BC42AA CAM ON',
      transferType: 'IN',
      transferAmount: 250000,
      checksum: 'opaque-pay2s-value',
      futureField: true,
    },
  ],
};

test('accepts Pay2S fields and permits future provider fields', () => {
  const payload = pay2sWebhookSchema.parse(sample);
  assert.equal(payload.transactions[0].id, '32756283');
  assert.equal(payload.transactions[0].futureField, true);
});

test('rejects malformed Pay2S batches', () => {
  assert.equal(pay2sWebhookSchema.safeParse({ transactions: [] }).success, false);
  assert.equal(
    pay2sWebhookSchema.safeParse({
      transactions: [{ ...sample.transactions[0], transferAmount: -1 }],
    }).success,
    false,
  );
});

test('extracts only complete payment codes', () => {
  assert.equal(extractPaymentCode(sample.transactions[0]), 'GALA7F3A91BC42AA');
  assert.equal(
    extractPaymentCode({ paymentCode: 'gala012345abcdef', content: '' }),
    'GALA012345ABCDEF',
  );
  assert.equal(extractPaymentCode({ content: 'XGALA7F3A91BC42AAY' }), null);
});

test('interprets offset-less Pay2S timestamps as Vietnam time', () => {
  assert.equal(parsePay2sDate('2026-10-03 03:43:57').toISOString(), '2026-10-02T20:43:57.000Z');
});

test('compares complete bearer credentials', () => {
  assert.equal(tokensEqual('Bearer secret', 'Bearer secret'), true);
  assert.equal(tokensEqual('Bearer wrong', 'Bearer secret'), false);
  assert.equal(tokensEqual('', 'Bearer secret'), false);
});

test('maps a successful VietQR response to its QR payload', async () => {
  const qrCode = await createQrPayload(
    {
      accountNumber: '0123456789',
      accountName: 'NGUYEN VAN A',
      bankCode: 'MB',
      transferContent: 'GALA7F3A91BC42AA',
      amountVnd: 250000,
    },
    {
      url: 'https://example.test/qr',
      fetch: async (_url, request) => {
        const body = JSON.parse(request.body);
        assert.equal(body.addInfo, 'GALA7F3A91BC42AA');
        assert.equal(body.amount, 250000);
        return { ok: true, json: async () => ({ code: '00', data: { qrCode: 'EMV-QR' } }) };
      },
    },
  );
  assert.equal(qrCode, 'EMV-QR');
});
