const path = require('node:path');
const { z } = require('zod');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true, quiet: true });

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const optionalBooleanFromString = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);

function optionalTrimmedString(min, max) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(min).max(max).optional(),
  );
}

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const emailList = z.preprocess(
  (value) =>
    String(value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  z.array(z.string().email()),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(1511),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanFromString,
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:1411'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:1411'),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default('gala.sid'),
  SESSION_COOKIE_SECURE: optionalBooleanFromString,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: optionalUrl,
  ADMIN_EMAILS: emailList,
  PAYMENTS_ENABLED: booleanFromString,
  TICKET_QR_ACTIVE_KEY_ID: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/),
  TICKET_QR_KEYS: z.string().min(1),
  PAY2S_WEBHOOK_TOKEN: optionalSecret,
  PAY2S_VIETQR_URL: z.string().url().default('https://api.pay2s.vn/vietqr/generate'),
  PAYMENT_BANK_CODE: optionalTrimmedString(2, 20),
  PAYMENT_ACCOUNT_NUMBER: optionalTrimmedString(3, 50),
  PAYMENT_ACCOUNT_NAME: optionalTrimmedString(2, 160),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${details.join('\n')}`);
}

const values = result.data;

if (
  values.PAYMENTS_ENABLED &&
  (!values.PAY2S_WEBHOOK_TOKEN ||
    !values.PAYMENT_BANK_CODE ||
    !values.PAYMENT_ACCOUNT_NUMBER ||
    !values.PAYMENT_ACCOUNT_NAME)
) {
  throw new Error(
    'PAY2S_WEBHOOK_TOKEN and PAYMENT_BANK_* settings are required when PAYMENTS_ENABLED=true.',
  );
}
const ticketQrKeys = Object.fromEntries(
  values.TICKET_QR_KEYS.split(',').map((entry) => {
    const [keyId, encodedKey, ...unexpected] = entry.trim().split(':');
    if (
      !keyId ||
      !encodedKey ||
      unexpected.length > 0 ||
      Buffer.from(encodedKey, 'base64url').length !== 32
    ) {
      throw new Error('TICKET_QR_KEYS entries must use keyId:base64url-encoded-32-byte-key.');
    }
    return [keyId, encodedKey];
  }),
);

if (!ticketQrKeys[values.TICKET_QR_ACTIVE_KEY_ID]) {
  throw new Error('TICKET_QR_ACTIVE_KEY_ID must exist in TICKET_QR_KEYS.');
}

const env = Object.freeze({
  nodeEnv: values.NODE_ENV,
  isProduction: values.NODE_ENV === 'production',
  port: values.PORT,
  databaseUrl: values.DATABASE_URL,
  databaseSsl: values.DATABASE_SSL,
  frontendOrigin: values.FRONTEND_ORIGIN,
  corsAllowedOrigins: values.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  sessionSecret: values.SESSION_SECRET,
  sessionCookieName: values.SESSION_COOKIE_NAME,
  sessionCookieSecure: values.SESSION_COOKIE_SECURE ?? values.NODE_ENV === 'production',
  google: {
    clientId: values.GOOGLE_CLIENT_ID,
    clientSecret: values.GOOGLE_CLIENT_SECRET,
    redirectUri: values.GOOGLE_REDIRECT_URI,
  },
  adminEmails: values.ADMIN_EMAILS,
  paymentsEnabled: values.PAYMENTS_ENABLED,
  ticketQr: {
    activeKeyId: values.TICKET_QR_ACTIVE_KEY_ID,
    keys: ticketQrKeys,
  },
  pay2s: {
    webhookToken: values.PAY2S_WEBHOOK_TOKEN,
    vietQrUrl: values.PAY2S_VIETQR_URL,
    bankCode: values.PAYMENT_BANK_CODE,
    accountNumber: values.PAYMENT_ACCOUNT_NUMBER,
    accountName: values.PAYMENT_ACCOUNT_NAME,
  },
});

module.exports = { env };
