import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db/init.js';

const validParams = {
  client_id: 'test-client',
  client_secret: 'test-secret',
  redirect_uri: 'http://localhost:8080/callback',
  response_type: 'code',
  scope: 'openid email',
};

async function issueAccessToken(app, scope = 'openid email') {
  const authorizationResponse = await request(app)
    .post('/oauth2/authorize')
    .type('form')
    .send({
      ...validParams,
      scope,
      username: 'testuser',
      password: 'password123',
    })
    .expect(302);

  const code = new URL(authorizationResponse.headers.location).searchParams.get('code');

  const tokenResponse = await request(app)
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

  return tokenResponse.body.access_token;
}

test('GET /userinfo returns claims for a valid bearer token', async () => {
  await initializeDatabase();
  const app = createApp();
  const accessToken = await issueAccessToken(app);

  const response = await request(app)
    .get('/userinfo')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200)
    .expect('Content-Type', /application\/json/);

  assert.equal(response.body.sub, 'user-testuser');
  assert.equal(response.body.email, 'testuser@example.com');
});

test('GET /userinfo returns 401 without an authorization header', async () => {
  await initializeDatabase();
  const app = createApp();

  const response = await request(app).get('/userinfo').expect(401);

  assert.equal(response.body.error, 'invalid_token');
});

test('GET /userinfo rejects invalid auth schemes and tokens', async () => {
  await initializeDatabase();
  const app = createApp();

  const wrongScheme = await request(app)
    .get('/userinfo')
    .set('Authorization', 'Basic abc')
    .expect(401);

  assert.equal(wrongScheme.body.error, 'invalid_token');

  const invalidToken = await request(app)
    .get('/userinfo')
    .set('Authorization', 'Bearer not-a-real-token')
    .expect(401);

  assert.equal(invalidToken.body.error, 'invalid_token');
});

test('POST /userinfo returns 405', async () => {
  await initializeDatabase();
  const app = createApp();

  await request(app)
    .post('/userinfo')
    .expect(405)
    .expect('Content-Type', /application\/json/);
});
