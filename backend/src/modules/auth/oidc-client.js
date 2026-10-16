const { env } = require('../../config/env');
const { AppError } = require('../../utils/app-error');

let configurationPromise;

function isGoogleAuthConfigured() {
  return Boolean(env.google.clientId && env.google.clientSecret && env.google.redirectUri);
}

function assertGoogleAuthConfigured() {
  if (!isGoogleAuthConfigured()) {
    throw new AppError(503, 'GOOGLE_AUTH_NOT_CONFIGURED', 'Đăng nhập hiện chưa sẵn sàng.');
  }
}

async function getClient() {
  assertGoogleAuthConfigured();
  const client = await import('openid-client');
  configurationPromise ??= client.discovery(
    new URL('https://accounts.google.com'),
    env.google.clientId,
    env.google.clientSecret,
  );
  return { client, configuration: await configurationPromise };
}

async function createAuthorizationRequest() {
  const { client, configuration } = await getClient();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const url = client.buildAuthorizationUrl(configuration, {
    redirect_uri: env.google.redirectUri,
    scope: 'openid email profile',
    response_type: 'code',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  return { url, state, nonce, codeVerifier };
}

async function exchangeAuthorizationCode(callbackUrl, flow) {
  const { client, configuration } = await getClient();
  return client.authorizationCodeGrant(configuration, callbackUrl, {
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    pkceCodeVerifier: flow.codeVerifier,
    idTokenExpected: true,
  });
}

module.exports = {
  isGoogleAuthConfigured,
  createAuthorizationRequest,
  exchangeAuthorizationCode,
};
