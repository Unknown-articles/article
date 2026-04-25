import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db/init.js';

test('GET /.well-known/openid-configuration returns required metadata', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .get('/.well-known/openid-configuration')
    .expect(200)
    .expect('Content-Type', /application\/json/);

  assert.equal(typeof response.body.issuer, 'string');
  assert.match(response.body.authorization_endpoint, /\/oauth2\/authorize$/);
  assert.match(response.body.token_endpoint, /\/oauth2\/token$/);
  assert.match(response.body.userinfo_endpoint, /\/userinfo$/);
  assert.match(response.body.jwks_uri, /jwks/);
  assert.ok(response.body.response_types_supported.includes('code'));
  assert.ok(response.body.subject_types_supported.length > 0);
  assert.ok(response.body.id_token_signing_alg_values_supported.includes('RS256'));
});
