import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get, buildAuthorizeUrl, loginAndGetCode } from '../helpers/http.js';
import { generatePKCE } from '../helpers/pkce.js';

const VALID_PARAMS = {
  client_id: 'test-client',
  redirect_uri: 'http://localhost:8080/callback',
  response_type: 'code',
  scope: 'openid profile email',
  state: 'test-state-abc123',
};

describe('GET /oauth2/authorize (Authorization Endpoint — Login Form)', () => {
  it('returns 200 with HTML login form for valid params', async () => {
    const { status, body } = await get(
      `/oauth2/authorize?${new URLSearchParams(VALID_PARAMS).toString()}`
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(typeof body === 'string', 'Response should be HTML text');
    assert.ok(body.includes('<form'), 'Response should contain an HTML form');
  });

  it('returns 400 when client_id is missing', async () => {
    const { client_id, ...params } = VALID_PARAMS;
    const { status } = await get(`/oauth2/authorize?${new URLSearchParams(params).toString()}`);
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('returns 400 when redirect_uri is missing', async () => {
    const { redirect_uri, ...params } = VALID_PARAMS;
    const { status } = await get(`/oauth2/authorize?${new URLSearchParams(params).toString()}`);
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('returns 400 when response_type is missing', async () => {
    const { response_type, ...params } = VALID_PARAMS;
    const { status } = await get(`/oauth2/authorize?${new URLSearchParams(params).toString()}`);
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('returns 400 when response_type is not "code"', async () => {
    const { status } = await get(
      `/oauth2/authorize?${new URLSearchParams({ ...VALID_PARAMS, response_type: 'token' }).toString()}`
    );
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('returns 400 when scope does not include "openid"', async () => {
    const { status } = await get(
      `/oauth2/authorize?${new URLSearchParams({ ...VALID_PARAMS, scope: 'profile email' }).toString()}`
    );
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('returns 400 for unknown client_id', async () => {
    const { status } = await get(
      `/oauth2/authorize?${new URLSearchParams({ ...VALID_PARAMS, client_id: 'unknown-client' }).toString()}`
    );
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('returns 400 for unregistered redirect_uri', async () => {
    const { status } = await get(
      `/oauth2/authorize?${new URLSearchParams({ ...VALID_PARAMS, redirect_uri: 'http://evil.com/callback' }).toString()}`
    );
    assert.equal(status, 400, `Expected 400, got ${status}`);
  });

  it('login form contains hidden fields for OAuth params', async () => {
    const { body } = await get(
      `/oauth2/authorize?${new URLSearchParams(VALID_PARAMS).toString()}`
    );
    assert.ok(body.includes('name="client_id"'), 'Form should have hidden client_id field');
    assert.ok(body.includes('name="redirect_uri"'), 'Form should have hidden redirect_uri field');
    assert.ok(body.includes('name="state"'), 'Form should have hidden state field');
  });
});

describe('POST /oauth2/authorize (Authorization Endpoint — Issue Code)', () => {
  it('redirects (302) with authorization code on valid credentials', async () => {
    const pkce = generatePKCE();
    const result = await loginAndGetCode({
      ...VALID_PARAMS,
      username: 'testuser',
      password: 'password123',
      ...pkce,
    });
    assert.equal(result.status, 302, `Expected 302 redirect, got ${result.status}`);
    assert.ok(result.code, 'Location header should contain a "code" query param');
  });

  it('authorization code is returned in redirect to correct redirect_uri', async () => {
    const pkce = generatePKCE();
    const result = await loginAndGetCode({
      ...VALID_PARAMS,
      username: 'testuser',
      password: 'password123',
      ...pkce,
    });
    assert.ok(result.location.startsWith(VALID_PARAMS.redirect_uri), 'Redirect location must start with redirect_uri');
    assert.ok(result.code?.length > 0, 'Code must not be empty');
  });

  it('state is echoed back in the redirect', async () => {
    const pkce = generatePKCE();
    const result = await loginAndGetCode({
      ...VALID_PARAMS,
      state: 'my-custom-state-xyz',
      username: 'testuser',
      password: 'password123',
      ...pkce,
    });
    assert.equal(result.state, 'my-custom-state-xyz', 'State must be preserved in redirect');
  });

  it('returns 401/form with error on wrong password', async () => {
    const pkce = generatePKCE();
    const res = await fetch('http://localhost:3000/oauth2/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...VALID_PARAMS,
        username: 'testuser',
        password: 'wrongpassword',
        ...pkce,
      }).toString(),
      redirect: 'manual',
    });
    // Should return the form again (with error message), not redirect
    assert.notEqual(res.status, 302, 'Should NOT redirect on wrong credentials');
    const body = await res.text();
    assert.ok(
      body.includes('Invalid') || body.includes('error') || body.includes('incorrect'),
      'Response should indicate invalid credentials'
    );
  });

  it('works without PKCE (plain authorization code flow)', async () => {
    const result = await loginAndGetCode({
      ...VALID_PARAMS,
      username: 'testuser',
      password: 'password123',
    });
    assert.equal(result.status, 302, `Expected 302, got ${result.status}`);
    assert.ok(result.code, 'Should receive authorization code');
  });

  it('second redirect URI is also accepted (http://localhost:3001/callback)', async () => {
    const pkce = generatePKCE();
    const result = await loginAndGetCode({
      ...VALID_PARAMS,
      redirect_uri: 'http://localhost:3001/callback',
      username: 'testuser',
      password: 'password123',
      ...pkce,
    });
    assert.equal(result.status, 302, `Expected 302, got ${result.status}`);
    assert.ok(result.code, 'Should receive authorization code');
  });
});
