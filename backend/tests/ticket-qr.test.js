const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost/unused';
process.env.SESSION_SECRET ||= 'test-session-secret-with-at-least-32-characters';
process.env.TICKET_QR_ACTIVE_KEY_ID ||= 'test-v1';
process.env.TICKET_QR_KEYS ||=
  'test-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,test-old:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

const { issueQrPayload, decryptQrPayload } = require('../src/modules/tickets/qr');

const ticketId = '6ad45306-6f89-4c8a-b5b7-9570b67c0ea8';

test('encrypts and decrypts an authenticated ticket QR', () => {
  const issued = issueQrPayload(ticketId);
  const decoded = decryptQrPayload(issued.payload);
  assert.equal(decoded.tid, ticketId);
  assert.equal(decoded.keyId, 'test-v1');
  assert.equal(decoded.hash, issued.hash);
});

test('ticket QR does not expose buyer PII or ticket UUID', () => {
  const issued = issueQrPayload(ticketId);
  assert.equal(issued.payload.includes(ticketId), false);
  assert.equal(issued.payload.includes('buyer@example.com'), false);
});

test('rejects a tampered ticket QR', () => {
  const issued = issueQrPayload(ticketId);
  const replacement = issued.payload.endsWith('A') ? 'B' : 'A';
  assert.throws(
    () => decryptQrPayload(`${issued.payload.slice(0, -1)}${replacement}`),
    (error) => error.code === 'QR_INVALID',
  );
});

test('supports old keys while issuing with the active key', () => {
  const old = issueQrPayload(ticketId, { keyId: 'test-old' });
  assert.equal(decryptQrPayload(old.payload).tid, ticketId);
  assert.equal(issueQrPayload(ticketId).keyId, 'test-v1');
});
