import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db/init.js';
import { listPublicJwks, rotateSigningKey } from '../src/services/key-service.js';

test('GET /.well-known/jwks.json returns RSA signing keys', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .get('/.well-known/jwks.json')
    .expect(200)
    .expect('Content-Type', /application\/json/);

  assert.ok(Array.isArray(response.body.keys));
  assert.ok(response.body.keys.length >= 1);

  const [firstKey] = response.body.keys;
  assert.equal(firstKey.kty, 'RSA');
  assert.equal(firstKey.use, 'sig');
  assert.equal(firstKey.alg, 'RS256');
  assert.equal(typeof firstKey.kid, 'string');
  assert.ok(firstKey.kid.length > 0);
  assert.equal(typeof firstKey.n, 'string');
  assert.equal(typeof firstKey.e, 'string');
});

test('signing key rotation keeps old keys published in JWKS', async () => {
  await initializeDatabase();
  const before = await listPublicJwks();

  await rotateSigningKey();

  const after = await listPublicJwks();
  const beforeKids = new Set(before.map((key) => key.kid));
  const afterKids = new Set(after.map((key) => key.kid));

  assert.ok(after.length > before.length);

  for (const kid of beforeKids) {
    assert.ok(afterKids.has(kid));
  }
});
