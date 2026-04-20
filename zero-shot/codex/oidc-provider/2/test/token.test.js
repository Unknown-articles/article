import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { importJWK, jwtVerify } from 'jose';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db/init.js';
import { listPublicJwks } from '../src/services/key-service.js';
import { sha256Base64Url } from '../src/utils/encoding.js';

const validParams = {
  client_id: 'test-client',
  client_secret: 'test-secret',
  redirect_uri: 'http://localhost:8080/callback',
  response_type: 'code',
  scope: 'openid email',
};

async function createAuthorizationCode(app, overrides = {}) {
  const response = await request(app)
    .post('/oauth2/authorize')
    .type('form')
    .send({
      ...validParams,
      username: 'testuser',
      password: 'password123',
      ...overrides,
    })
    .expect(302);

  return new URL(response.headers.location).searchParams.get('code');
}

test('POST /oauth2/token returns tokens for body client auth', async () => {
  await initializeDatabase();
  const app = createApp();
  const code = await createAuthorizationCode(app);

  const response = await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: validParams.redirect_uri,
      client_id: validParams.client_id,
      client_secret: validParams.client_secret,
    })
    .expect(200)
    .expect('Content-Type', /application\/json/);

  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(typeof response.body.access_token, 'string');
  assert.match(response.body.id_token, /^[^.]+\.[^.]+\.[^.]+$/);
  assert.equal(response.body.token_type, 'Bearer');
  assert.equal(typeof response.body.expires_in, 'number');

  const [publicJwk] = await listPublicJwks();
  const publicKey = await importJWK(publicJwk, 'RS256');
  const verified = await jwtVerify(response.body.id_token, publicKey, {
    issuer: 'http://localhost:3000',
    audience: validParams.client_id,
  });

  assert.equal(verified.protectedHeader.alg, 'RS256');
  assert.equal(verified.protectedHeader.kid, publicJwk.kid);
  assert.equal(verified.payload.sub, 'user-testuser');
  assert.equal(verified.payload.iss, 'http://localhost:3000');
  assert.ok(verified.payload.exp > verified.payload.iat);
});

test('POST /oauth2/token supports HTTP Basic client auth', async () => {
  await initializeDatabase();
  const app = createApp();
  const code = await createAuthorizationCode(app);
  const basic = Buffer.from('test-client:test-secret').toString('base64');

  const response = await request(app)
    .post('/oauth2/token')
    .set('Authorization', `Basic ${basic}`)
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: validParams.redirect_uri,
    })
    .expect(200);

  assert.equal(response.body.token_type, 'Bearer');
});

test('POST /oauth2/token enforces required request fields and grant type', async () => {
  await initializeDatabase();
  const app = createApp();

  const missingGrant = await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({})
    .expect(400);

  assert.equal(missingGrant.body.error, 'invalid_request');

  const unsupportedGrant = await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({ grant_type: 'refresh_token', code: 'x', redirect_uri: validParams.redirect_uri })
    .expect(400);

  assert.equal(unsupportedGrant.body.error, 'unsupported_grant_type');
});

test('POST /oauth2/token rejects invalid clients', async () => {
  await initializeDatabase();
  const app = createApp();
  const code = await createAuthorizationCode(app);

  const response = await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: validParams.redirect_uri,
      client_id: 'test-client',
      client_secret: 'wrong-secret',
    })
    .expect(401);

  assert.equal(response.body.error, 'invalid_client');
});

test('POST /oauth2/token rejects reused authorization codes', async () => {
  await initializeDatabase();
  const app = createApp();
  const code = await createAuthorizationCode(app);

  await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: validParams.redirect_uri,
      client_id: validParams.client_id,
      client_secret: validParams.client_secret,
    })
    .expect(200);

  const replay = await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: validParams.redirect_uri,
      client_id: validParams.client_id,
      client_secret: validParams.client_secret,
    })
    .expect(400);

  assert.equal(replay.body.error, 'invalid_grant');
});

test('POST /oauth2/token validates PKCE S256', async () => {
  await initializeDatabase();
  const app = createApp();
  const codeVerifier = 'pkce-verifier-value';
  const code = await createAuthorizationCode(app, {
    code_challenge: sha256Base64Url(codeVerifier),
    code_challenge_method: 'S256',
  });

  const invalidResponse = await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: validParams.redirect_uri,
      client_id: validParams.client_id,
      client_secret: validParams.client_secret,
      code_verifier: 'wrong-verifier',
    })
    .expect(400);

  assert.equal(invalidResponse.body.error, 'invalid_grant');

  const validCode = await createAuthorizationCode(app, {
    code_challenge: sha256Base64Url(codeVerifier),
    code_challenge_method: 'S256',
  });

  await request(app)
    .post('/oauth2/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code: validCode,
      redirect_uri: validParams.redirect_uri,
      client_id: validParams.client_id,
      client_secret: validParams.client_secret,
      code_verifier: codeVerifier,
    })
    .expect(200);
});
