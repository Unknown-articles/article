import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { postForm, loginAndGetCode, basicAuth } from '../helpers/http.js';
import { generatePKCE } from '../helpers/pkce.js';

const CLIENT_ID = 'test-client';
const CLIENT_SECRET = 'test-secret';
const REDIRECT_URI = 'http://localhost:8080/callback';
const SCOPE = 'openid profile email';

/**
 * Helper: get a fresh auth code with PKCE.
 */
async function getAuthCode(pkce) {
  return loginAndGetCode({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state: 'state123',
    username: 'testuser',
    password: 'password123',
    ...pkce,
  });
}

/**
 * Parse a JWT payload (no verification — just decode base64url).
 */
function parseJwtPayload(jwt) {
  const parts = jwt.split('.');
  assert.equal(parts.length, 3, 'JWT must have 3 parts');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

describe('POST /oauth2/token (Token Endpoint)', () => {
  it('returns 400 when grant_type is missing', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      code: 'dummy',
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_request');
  });

  it('returns 400 for unsupported grant_type', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'unsupported_grant_type');
  });

  it('returns 400 when code is missing', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_request');
  });

  it('returns 400 when redirect_uri is missing', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code: 'dummy',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_request');
  });

  it('returns 401 when client_id is missing', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code: 'dummy',
      redirect_uri: REDIRECT_URI,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 401);
    assert.equal(body.error, 'invalid_client');
  });

  it('returns 401 for unknown client', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code: 'dummy',
      redirect_uri: REDIRECT_URI,
      client_id: 'unknown-client',
      client_secret: 'any-secret',
    });
    assert.equal(status, 401);
    assert.equal(body.error, 'invalid_client');
  });

  it('returns 401 for wrong client_secret', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code: 'dummy',
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: 'wrong-secret',
    });
    assert.equal(status, 401);
    assert.equal(body.error, 'invalid_client');
  });

  it('returns 400 for invalid/unknown authorization code', async () => {
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code: 'totally-fake-code-xyz',
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_grant');
  });

  it('returns tokens successfully (without PKCE)', async () => {
    const { code } = await getAuthCode({});
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 200, `Expected 200, got ${status}. Body: ${JSON.stringify(body)}`);
    assert.ok(body.access_token, 'Response must include access_token');
    assert.ok(body.id_token, 'Response must include id_token');
    assert.equal(body.token_type, 'Bearer', 'token_type must be Bearer');
    assert.ok(typeof body.expires_in === 'number', 'expires_in must be a number');
  });

  it('returns tokens successfully with PKCE (S256)', async () => {
    const pkce = generatePKCE();
    const { code } = await getAuthCode(pkce);

    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: pkce.code_verifier,
    });
    assert.equal(status, 200, `Expected 200, got ${status}. Body: ${JSON.stringify(body)}`);
    assert.ok(body.access_token, 'Response must include access_token');
    assert.ok(body.id_token, 'Response must include id_token');
  });

  it('returns 400 when PKCE code_verifier is wrong', async () => {
    const pkce = generatePKCE();
    const { code } = await getAuthCode(pkce);

    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: 'wrong-verifier-value-that-does-not-match',
    });
    assert.equal(status, 400, `Expected 400, got ${status}`);
    assert.equal(body.error, 'invalid_grant');
  });

  it('returns 400 when auth code is reused (replay prevention)', async () => {
    const { code } = await getAuthCode({});

    // First exchange succeeds
    await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    // Second exchange must fail
    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400, `Expected 400 on code reuse, got ${status}`);
    assert.equal(body.error, 'invalid_grant');
  });

  it('returns 400 when redirect_uri does not match', async () => {
    const { code } = await getAuthCode({});

    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:3001/callback', // different URI
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400, `Expected 400, got ${status}`);
    assert.equal(body.error, 'invalid_grant');
  });

  it('accepts client credentials via HTTP Basic auth header', async () => {
    const { code } = await getAuthCode({});
    const { status, body } = await postForm(
      '/oauth2/token',
      { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI },
      { headers: { Authorization: basicAuth(CLIENT_ID, CLIENT_SECRET) } }
    );
    assert.equal(status, 200, `Expected 200, got ${status}. Body: ${JSON.stringify(body)}`);
    assert.ok(body.access_token, 'Response must include access_token');
  });

  it('id_token is a valid JWT with required claims', async () => {
    const { code } = await getAuthCode({});
    const { body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const payload = parseJwtPayload(body.id_token);
    assert.ok(payload.sub, 'id_token must have "sub" claim');
    assert.ok(payload.iss, 'id_token must have "iss" claim');
    assert.ok(payload.aud, 'id_token must have "aud" claim');
    assert.ok(payload.exp, 'id_token must have "exp" claim');
    assert.ok(payload.iat, 'id_token must have "iat" claim');
  });

  it('id_token aud matches the client_id', async () => {
    const { code } = await getAuthCode({});
    const { body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const payload = parseJwtPayload(body.id_token);
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    assert.ok(aud.includes(CLIENT_ID), `id_token aud must include client_id "${CLIENT_ID}", got: ${JSON.stringify(payload.aud)}`);
  });

  it('response has Cache-Control: no-store header', async () => {
    const { code } = await getAuthCode({});
    const res = await fetch('http://localhost:3000/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString(),
    });
    const cacheControl = res.headers.get('cache-control');
    assert.ok(
      cacheControl?.includes('no-store'),
      `Cache-Control should include no-store, got: ${cacheControl}`
    );
  });
});
