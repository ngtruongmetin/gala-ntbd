const test = require('node:test');
const assert = require('node:assert/strict');
const { createOrderSchema } = require('../src/modules/orders/validation');
const { manualCheckInSchema } = require('../src/modules/checkin/validation');

test('normalizes valid buyer data', () => {
  const result = createOrderSchema.parse({
    fullName: '  Nguyễn   Văn An  ',
    phone: '090 123 4567',
    quantity: '2',
  });
  assert.deepEqual(result, { fullName: 'NGUYỄN VĂN AN', phone: '0901234567', quantity: 2 });
});

for (const [name, input] of [
  ['empty name', { fullName: ' ', phone: '0901234567', quantity: 1 }],
  ['invalid name', { fullName: 'NGUYEN 123', phone: '0901234567', quantity: 1 }],
  ['invalid phone', { fullName: 'NGUYEN AN', phone: '12345', quantity: 1 }],
  ['zero quantity', { fullName: 'NGUYEN AN', phone: '0901234567', quantity: 0 }],
  ['fractional quantity', { fullName: 'NGUYEN AN', phone: '0901234567', quantity: 1.5 }],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(createOrderSchema.safeParse(input).success, false);
  });
}

test('rejects client supplied email and price fields', () => {
  const result = createOrderSchema.safeParse({
    fullName: 'NGUYEN AN',
    phone: '0901234567',
    quantity: 1,
    email: 'attacker@example.com',
    unitPriceVnd: 1,
  });
  assert.equal(result.success, false);
});

test('normalizes manually entered ticket codes to uppercase', () => {
  const result = manualCheckInSchema.parse({
    requestId: '6eec8058-ae85-4a20-9f20-6dd38a0fde53',
    ticketCode: '  gt-ab12cd  ',
  });
  assert.equal(result.ticketCode, 'GT-AB12CD');
});
