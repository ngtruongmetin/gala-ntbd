const crypto = require('node:crypto');
const { env } = require('../../config/env');
const { AppError } = require('../../utils/app-error');

const PREFIX = 'gala';
const TOKEN_VERSION = 't1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getKey(keyId, keyRing = env.ticketQr.keys) {
  const encodedKey = keyRing[keyId];
  if (!encodedKey) {
    throw new AppError(400, 'QR_KEY_UNKNOWN', 'Mã vé sử dụng khóa không còn khả dụng.');
  }
  return Buffer.from(encodedKey, 'base64url');
}

function hashQrPayload(payload) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function issueQrPayload(ticketId, options = {}) {
  const keyId = options.keyId ?? env.ticketQr.activeKeyId;
  const keyRing = options.keyRing ?? env.ticketQr.keys;
  const key = getKey(keyId, keyRing);
  const issuedAt = options.issuedAt ?? new Date();
  const issuanceId = options.issuanceId ?? crypto.randomUUID();
  const header = `${PREFIX}:${TOKEN_VERSION}:${keyId}`;
  const iv = options.iv ?? crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(header));
  const plaintext = Buffer.from(
    JSON.stringify({ v: 1, tid: ticketId, jti: issuanceId, iat: issuedAt.toISOString() }),
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = `${header}:${Buffer.concat([iv, ciphertext, authTag]).toString('base64url')}`;

  return {
    payload,
    hash: hashQrPayload(payload),
    keyId,
    version: 1,
    issuedAt,
    issuanceId,
  };
}

function decryptQrPayload(payload, options = {}) {
  try {
    const [prefix, version, keyId, encoded, ...unexpected] = payload.split(':');
    if (
      prefix !== PREFIX ||
      version !== TOKEN_VERSION ||
      !keyId ||
      !encoded ||
      unexpected.length > 0
    ) {
      throw new Error('Invalid ticket QR envelope.');
    }
    const key = getKey(keyId, options.keyRing ?? env.ticketQr.keys);
    const envelope = Buffer.from(encoded, 'base64url');
    if (envelope.length <= IV_BYTES + AUTH_TAG_BYTES) throw new Error('Ticket QR is truncated.');
    const iv = envelope.subarray(0, IV_BYTES);
    const authTag = envelope.subarray(envelope.length - AUTH_TAG_BYTES);
    const ciphertext = envelope.subarray(IV_BYTES, envelope.length - AUTH_TAG_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(`${prefix}:${version}:${keyId}`));
    decipher.setAuthTag(authTag);
    const decoded = JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'),
    );
    if (
      decoded.v !== 1 ||
      typeof decoded.tid !== 'string' ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.iat !== 'string'
    ) {
      throw new Error('Ticket QR payload is invalid.');
    }
    return { ...decoded, keyId, hash: hashQrPayload(payload) };
  } catch (error) {
    if (error instanceof AppError && error.code === 'QR_KEY_UNKNOWN') throw error;
    throw new AppError(400, 'QR_INVALID', 'Mã QR vé không hợp lệ.');
  }
}

module.exports = { issueQrPayload, decryptQrPayload, hashQrPayload };
