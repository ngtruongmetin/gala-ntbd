const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth } = require('../src/middlewares/auth');
const { requireCsrf } = require('../src/middlewares/csrf');
const { parseGoogleClaims } = require('../src/modules/auth/validation');

test('rejects unauthenticated order access', () => {
  let forwardedError;
  requireAuth({ session: {} }, {}, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError.statusCode, 401);
  assert.equal(forwardedError.code, 'AUTH_REQUIRED');
});

test('requires a matching CSRF token', () => {
  let forwardedError;
  requireCsrf({ session: { csrfToken: 'expected' }, get: () => 'wrong' }, {}, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError.statusCode, 403);
});

test('requires Google verified email claims', () => {
  assert.equal(
    parseGoogleClaims({ sub: 'subject', email: 'buyer@example.com', email_verified: true }).sub,
    'subject',
  );
  assert.throws(() =>
    parseGoogleClaims({ sub: 'subject', email: 'buyer@example.com', email_verified: false }),
  );
});

test('logout destroys the session and clears the cookie', async () => {
  process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost/unused';
  process.env.SESSION_SECRET ||= 'test-session-secret-with-at-least-32-characters';
  const { logout } = require('../src/modules/auth/controller');
  let destroyed = false;
  let clearedCookie;
  let statusCode;
  const request = {
    session: {
      destroy(callback) {
        destroyed = true;
        callback();
      },
    },
  };
  const response = {
    clearCookie(name) {
      clearedCookie = name;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    end() {},
  };

  await logout(request, response);
  assert.equal(destroyed, true);
  assert.equal(clearedCookie, 'gala.sid');
  assert.equal(statusCode, 204);
});
