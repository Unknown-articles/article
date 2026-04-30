import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { importJWK, jwtVerify } from 'jose';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oidc-provider-test-'));
process.env.DB_PATH = path.join(tempDir, 'oidc.sqlite');
process.env.PORT = '4000';

const { createApp } = await import('../src/server.js');
const { closeDatabase, initializeDatabase } = await import('../src/db.js');
const { ensureSigningKey } = await import('../src/services/keys.js');

let server;
let baseUrl;

before(async () => {
  await initializeDatabase();
  await ensureSigningKey();
  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('serves OIDC discovery metadata and JWKS', async () => {
  const discovery = await getJson('/.well-known/openid-configuration');
  assert.equal(discovery.issuer, 'http://localhost:4000');
  assert.match(discovery.authorization_endpoint, /\/oauth2\/authorize$/);
  assert.match(discovery.token_endpoint, /\/oauth2\/token$/);
  assert.match(discovery.userinfo_endpoint, /\/userinfo$/);
  assert.match(discovery.jwks_uri, /jwks/);
  assert.ok(discovery.response_types_supported.includes('code'));
  assert.ok(discovery.subject_types_supported.length > 0);
  assert.ok(discovery.id_token_signing_alg_values_supported.includes('RS256'));

  const jwks = await getJson('/.well-known/jwks.json');
  assert.ok(jwks.keys.length >= 1);
  assert.equal(jwks.keys[0].kty, 'RSA');
  assert.equal(jwks.keys[0].use, 'sig');
  assert.equal(jwks.keys[0].alg, 'RS256');
  assert.ok(jwks.keys[0].kid);
  assert.ok(jwks.keys[0].n);
  assert.ok(jwks.keys[0].e);
});

test('runs authorization code flow and verifies id_token with JWKS', async () => {
  const login = await fetch(`${baseUrl}/oauth2/authorize?${new URLSearchParams({
    client_id: 'test-client',
    redirect_uri: 'http://localhost:8080/callback',
    response_type: 'code',
    scope: 'openid email',
    state: 'state-123'
  })}`);
  assert.equal(login.status, 200);
  assert.match(login.headers.get('content-type'), /^text\/html/);
  const loginHtml = await login.text();
  assert.match(loginHtml, /<form/);
  assert.match(loginHtml, /name="client_id"/);
  assert.match(loginHtml, /name="redirect_uri"/);
  assert.match(loginHtml, /name="state"/);

  const authResponse = await postForm('/oauth2/authorize', {
    client_id: 'test-client',
    redirect_uri: 'http://localhost:8080/callback',
    response_type: 'code',
    scope: 'openid email',
    state: 'state-123',
    username: 'testuser',
    password: 'password123'
  }, { redirect: 'manual' });
  assert.equal(authResponse.status, 302);

  const redirect = new URL(authResponse.headers.get('location'));
  assert.equal(redirect.origin + redirect.pathname, 'http://localhost:8080/callback');
  assert.equal(redirect.searchParams.get('state'), 'state-123');
  const code = redirect.searchParams.get('code');
  assert.ok(code);

  const tokenResponse = await postForm('/oauth2/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://localhost:8080/callback',
    client_id: 'test-client',
    client_secret: 'test-secret'
  });
  assert.equal(tokenResponse.status, 200);
  assert.equal(tokenResponse.headers.get('cache-control'), 'no-store');

  const tokens = await tokenResponse.json();
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.id_token.split('.').length, 3);
  assert.ok(tokens.access_token);
  assert.ok(tokens.expires_in > 0);

  const jwks = await getJson('/.well-known/jwks.json');
  const publicKey = await importJWK(jwks.keys[0], 'RS256');
  const verified = await jwtVerify(tokens.id_token, publicKey, {
    issuer: 'http://localhost:4000',
    audience: 'test-client'
  });
  assert.equal(verified.protectedHeader.alg, 'RS256');
  assert.equal(verified.protectedHeader.kid, jwks.keys[0].kid);
  assert.equal(verified.payload.sub, '1');

  const userinfo = await fetch(`${baseUrl}/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  assert.equal(userinfo.status, 200);
  assert.deepEqual(await userinfo.json(), {
    sub: '1',
    email: 'testuser@example.com'
  });

  const replay = await postForm('/oauth2/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://localhost:8080/callback',
    client_id: 'test-client',
    client_secret: 'test-secret'
  });
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'invalid_grant');
});

test('supports PKCE S256 and HTTP Basic client authentication', async () => {
  const verifier = 'test-verifier-with-enough-entropy';
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    .toString('base64url');

  const authResponse = await postForm('/oauth2/authorize', {
    client_id: 'test-client',
    redirect_uri: 'http://localhost:3001/callback',
    response_type: 'code',
    scope: 'openid email',
    username: 'testuser',
    password: 'password123',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }, { redirect: 'manual' });
  assert.equal(authResponse.status, 302);
  const code = new URL(authResponse.headers.get('location')).searchParams.get('code');

  const badVerifier = await postForm('/oauth2/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://localhost:3001/callback',
    code_verifier: 'wrong-verifier'
  }, {
    headers: {
      Authorization: `Basic ${Buffer.from('test-client:test-secret').toString('base64')}`
    }
  });
  assert.equal(badVerifier.status, 400);
  assert.equal((await badVerifier.json()).error, 'invalid_grant');

  const secondAuth = await postForm('/oauth2/authorize', {
    client_id: 'test-client',
    redirect_uri: 'http://localhost:3001/callback',
    response_type: 'code',
    scope: 'openid email',
    username: 'testuser',
    password: 'password123',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }, { redirect: 'manual' });
  const secondCode = new URL(secondAuth.headers.get('location')).searchParams.get('code');

  const tokenResponse = await postForm('/oauth2/token', {
    grant_type: 'authorization_code',
    code: secondCode,
    redirect_uri: 'http://localhost:3001/callback',
    code_verifier: verifier
  }, {
    headers: {
      Authorization: `Basic ${Buffer.from('test-client:test-secret').toString('base64')}`
    }
  });
  assert.equal(tokenResponse.status, 200);
  assert.equal((await tokenResponse.json()).token_type, 'Bearer');
});

async function getJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  return response.json();
}

async function postForm(pathname, body, options = {}) {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...options.headers
  };

  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    body: new URLSearchParams(body),
    ...options,
    headers
  });
}
