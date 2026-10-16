const REQUIRED_METHODS = ['createQrPayload'];

function assertPaymentProvider(provider) {
  for (const method of REQUIRED_METHODS) {
    if (typeof provider?.[method] !== 'function') {
      throw new TypeError(`Payment provider must implement ${method}().`);
    }
  }

  return provider;
}

module.exports = { assertPaymentProvider };
