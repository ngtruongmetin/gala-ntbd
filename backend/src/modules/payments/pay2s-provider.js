const { AppError } = require('../../utils/app-error');

async function createQrPayload(instructions, dependencies = {}) {
  const fetchImplementation = dependencies.fetch ?? fetch;
  const url = dependencies.url ?? require('../../config/env').env.pay2s.vietQrUrl;
  let response;
  try {
    response = await fetchImplementation(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accountNo: instructions.accountNumber,
        accountName: instructions.accountName,
        bankCode: instructions.bankCode,
        addInfo: instructions.transferContent,
        amount: instructions.amountVnd,
        template: 'modern',
        maskAccount: false,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AppError(502, 'PAYMENT_QR_UNAVAILABLE', 'Khong the tao ma QR thanh toan luc nay.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== '00' || !payload?.data?.qrCode) {
    throw new AppError(502, 'PAYMENT_QR_UNAVAILABLE', 'Khong the tao ma QR thanh toan luc nay.');
  }
  return payload.data.qrCode;
}

module.exports = { createQrPayload };
