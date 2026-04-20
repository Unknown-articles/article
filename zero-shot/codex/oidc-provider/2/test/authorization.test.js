import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db/init.js';
import { findAuthorizationCode } from '../src/services/authorization-service.js';

const validParams = {
  client_id: 'test-client',
  redirect_uri: 'http://localhost:8080/callback',
  response_type: 'code',
  scope: 'openid email',
  state: 'abc123',
};

test('GET /oauth2/authorize renders the login form for valid requests', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .get('/oauth2/authorize')
    .query(validParams)
    .expect(200)
    .expect('Content-Type', /text\/html/);

  assert.match(response.text, /<form/i);
  assert.match(response.text, /name="client_id"/);
  assert.match(response.text, /name="redirect_uri"/);
  assert.match(response.text, /name="state"/);
});

test('GET /oauth2/authorize rejects invalid requests', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .get('/oauth2/authorize')
    .query({ ...validParams, scope: 'profile' })
    .expect(400)
    .expect('Content-Type', /application\/json/);

  assert.equal(response.body.error, 'invalid_scope');
});

test('POST /oauth2/authorize redirects with code and state for valid credentials', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .post('/oauth2/authorize')
    .type('form')
    .send({
      ...validParams,
      username: 'testuser',
      password: 'password123',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    })
    .expect(302);

  const redirectUrl = new URL(response.headers.location);
  const code = redirectUrl.searchParams.get('code');

  assert.equal(redirectUrl.origin + redirectUrl.pathname, validParams.redirect_uri);
  assert.equal(redirectUrl.searchParams.get('state'), validParams.state);
  assert.ok(code);

  const storedCode = await findAuthorizationCode(code);
  assert.equal(storedCode.code_challenge, 'challenge');
  assert.equal(storedCode.code_challenge_method, 'S256');
});

test('POST /oauth2/authorize accepts the second registered redirect URI', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .post('/oauth2/authorize')
    .type('form')
    .send({
      ...validParams,
      redirect_uri: 'http://localhost:3001/callback',
      username: 'testuser',
      password: 'password123',
    })
    .expect(302);

  assert.match(response.headers.location, /^http:\/\/localhost:3001\/callback\?/);
});

test('POST /oauth2/authorize re-renders form on invalid credentials', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app)
    .post('/oauth2/authorize')
    .type('form')
    .send({
      ...validParams,
      username: 'testuser',
      password: 'wrong-password',
    })
    .expect(401)
    .expect('Content-Type', /text\/html/);

  assert.match(response.text, /Invalid|error|incorrect/i);
});
