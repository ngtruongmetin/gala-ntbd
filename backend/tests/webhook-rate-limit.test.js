const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { webhookRateLimiter } = require('../src/middlewares/rate-limiters');

function request(port) {
  return new Promise((resolve, reject) => {
    const clientRequest = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/pay2s',
        headers: { 'content-type': 'application/json', 'content-length': '2' },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      },
    );
    clientRequest.on('error', reject);
    clientRequest.end('{}');
  });
}

test('limits webhook traffic independently', async () => {
  const app = express();
  app.post('/pay2s', webhookRateLimiter, (_request, response) => response.status(204).end());
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const port = server.address().port;
    const statuses = await Promise.all(Array.from({ length: 61 }, () => request(port)));
    assert.equal(statuses.filter((status) => status === 204).length, 60);
    assert.equal(statuses.filter((status) => status === 429).length, 1);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
