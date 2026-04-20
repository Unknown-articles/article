'use strict';

const { suite, test, assertStatus, assert } = require('./framework');
const { http } = require('./client');

suite('1. Health Check', async () => {
  await test('GET /health returns 200 with status ok', async () => {
    const res = await http.get('/health');
    assertStatus(res, 200);
    assert(res.data.status === 'ok', `Expected status "ok", got "${res.data.status}"`);
  });
});
