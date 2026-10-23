const crypto = require('node:crypto');
const { env } = require('../../config/env');
const { AppError } = require('../../utils/app-error');
const { parseInput } = require('../../utils/validation');
const { pay2sWebhookSchema } = require('./validation');
const service = require('./service');

function tokensEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function pay2s(request, response) {
  const authorization = request.get('authorization') ?? '';
  const expected = `Bearer ${env.pay2s.webhookToken ?? ''}`;
  if (!env.pay2s.webhookToken || !tokensEqual(authorization, expected)) {
    request.log.warn(
      { event: 'payment_webhook_rejected', reason: 'invalid_authorization' },
      'Pay2S webhook rejected',
    );
    throw new AppError(403, 'WEBHOOK_UNAUTHORIZED', 'Webhook token khong hop le.');
  }
  const payload = parseInput(pay2sWebhookSchema, request.body, 'Pay2S webhook khong hop le.');
  const results = await service.processWebhook(payload.transactions);
  request.log.info(
    { transactions: results.map(({ reference, matchStatus }) => ({ reference, matchStatus })) },
    'Pay2S webhook processed',
  );
  response.json({ success: true });
}

module.exports = { pay2s, tokensEqual };
