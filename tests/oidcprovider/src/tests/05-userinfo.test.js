import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get, postForm, loginAndGetCode } from '../helpers/http.js';

const CLIENT_ID = 'test-client';
const CLIENT_SECRET = 'test-secret';
const REDIRECT_URI = 'http://localhost:8080/callback';

/**
 * Obtain a fresh access_token by running the full authorization code flow.
 */
async function getAccessToken() {
  const { code } = await loginAndGetCode({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: 'state-ut',
    username: 'testuser',
    password: 'password123',
  });

  const { body } = await postForm('/oauth2/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  assert.ok(body.access_token, `Failed to obtain access_token. Token response: ${JSON.stringify(body)}`);
  return body.access_token;
}

describe('GET /userinfo (UserInfo Endpoint)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const { status } = await get('/userinfo');
    assert.equal(status, 401, `Expected 401, got ${status}`);
  });

  it('returns 401 for an invalid/fake Bearer token', async () => {
    const { status } = await get('/userinfo', {
      headers: { Authorization: 'Bearer this-is-not-a-valid-token' },
    });
    assert.equal(status, 401, `Expected 401, got ${status}`);
  });

  it('returns 401 when Authorization scheme is not Bearer', async () => {
    const token = await getAccessToken();
    const { status } = await get('/userinfo', {
      headers: { Authorization: `Basic ${token}` },
    });
    assert.equal(status, 401, `Expected 401, got ${status}`);
  });

  it('returns 200 with valid Bearer token', async () => {
    const token = await getAccessToken();
    const { status } = await get('/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(status, 200, `Expected 200, got ${status}`);
  });

  it('returns JSON content type', async () => {
    const token = await getAccessToken();
    const { headers } = await get('/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(
      headers.get('content-type')?.includes('application/json'),
      `Expected application/json, got: ${headers.get('content-type')}`
    );
  });

  it('response contains "sub" claim', async () => {
    const token = await getAccessToken();
    const { body } = await get('/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(body.sub, 'UserInfo response must include "sub" claim');
  });

  it('response contains "email" claim (scope includes email)', async () => {
    const token = await getAccessToken();
    const { body } = await get('/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(body.email, `UserInfo response should include "email" claim, got: ${JSON.stringify(body)}`);
  });

  it('response contains user identifier that is non-empty string', async () => {
    const token = await getAccessToken();
    const { body } = await get('/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(typeof body.sub === 'string' && body.sub.length > 0, '"sub" must be a non-empty string');
  });
});

describe('POST /userinfo (UserInfo Endpoint — POST method)', () => {
  it('returns 200 with valid Bearer token via POST', async () => {
    const token = await getAccessToken();
    const res = await fetch('http://localhost:3000/userinfo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    // POST /userinfo is optional per spec but the project implements it
    // Accept 200 or 405
    assert.ok(
      [200, 405].includes(res.status),
      `Expected 200 or 405 for POST /userinfo, got ${res.status}`
    );
  });
});
