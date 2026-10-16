const { env } = require('../../config/env');
const service = require('./service');
const {
  isGoogleAuthConfigured,
  createAuthorizationRequest,
  exchangeAuthorizationCode,
} = require('./oidc-client');
const { ensureCsrfToken, createCsrfToken } = require('../../middlewares/csrf');
const { saveSession, regenerateSession, destroySession } = require('../../utils/session');
const { AppError } = require('../../utils/app-error');
const adminRepository = require('../admin/repository');

function normalizeReturnTo(value) {
  return typeof value === 'string' &&
    ['/dat-ve', '/tai-khoan', '/check-in', '/admin', '/'].includes(value)
    ? value
    : '/';
}

async function startGoogleLogin(request, response) {
  const authorization = await createAuthorizationRequest();
  request.session.oauth = {
    state: authorization.state,
    nonce: authorization.nonce,
    codeVerifier: authorization.codeVerifier,
    returnTo: normalizeReturnTo(request.query.returnTo),
    createdAt: Date.now(),
  };
  await saveSession(request.session);
  response.redirect(authorization.url.href);
}

async function handleGoogleCallback(request, response) {
  const flow = request.session.oauth;
  if (!flow || Date.now() - flow.createdAt > 10 * 60_000) {
    throw new AppError(
      400,
      'OAUTH_FLOW_INVALID',
      'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.',
    );
  }

  delete request.session.oauth;
  await saveSession(request.session);

  const callbackUrl = new URL(env.google.redirectUri);
  callbackUrl.search = new URL(request.originalUrl, 'http://localhost').search;
  const tokens = await exchangeAuthorizationCode(callbackUrl, flow);
  const claims = tokens.claims();
  if (!claims) {
    throw new AppError(401, 'GOOGLE_ID_TOKEN_MISSING', 'Google không trả về danh tính hợp lệ.');
  }

  const user = await service.authenticateGoogleClaims(claims);
  await regenerateSession(request.session);
  request.session.user = user;
  request.session.csrfToken = createCsrfToken();
  await saveSession(request.session);

  response.redirect(new URL(flow.returnTo, env.frontendOrigin).href);
}

async function getCurrentUser(request, response) {
  const csrfToken = ensureCsrfToken(request.session);
  if (request.session.user?.id) {
    await adminRepository.syncConfiguredAdmin(
      request.session.user.id,
      request.session.user.email,
      env.adminEmails,
    );
    request.session.user.roles = await adminRepository.getUserRoles(request.session.user.id);
  }
  await saveSession(request.session);
  response.json({
    data: {
      authenticated: Boolean(request.session.user?.id),
      user: request.session.user ?? null,
      csrfToken,
      googleAuthAvailable: isGoogleAuthConfigured(),
    },
  });
}

async function logout(request, response) {
  await destroySession(request.session);
  response.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure: env.sessionCookieSecure,
    sameSite: 'lax',
  });
  response.status(204).end();
}

module.exports = { startGoogleLogin, handleGoogleCallback, getCurrentUser, logout };
