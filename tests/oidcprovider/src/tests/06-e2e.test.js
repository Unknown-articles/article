/**
 * End-to-End tests: Full OIDC Authorization Code Flow with PKCE.
 * These tests simulate a complete client application interacting with the provider.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { postForm, loginAndGetCode, get } from '../helpers/http.js';
import { generatePKCE } from '../helpers/pkce.js';
import { createVerify } from 'node:crypto';

const CLIENT_ID = 'test-client';
const CLIENT_SECRET = 'test-secret';
const REDIRECT_URI = 'http://localhost:8080/callback';
const SCOPE = 'openid profile email';

/**
 * Convert a base64url-encoded BigInt string to a PEM public key parameter (for testing RSA signature).
 */
function base64urlToBigInt(b64) {
  return BigInt('0x' + Buffer.from(b64, 'base64url').toString('hex'));
}

/**
 * Verify a JWT's RS256 signature using the JWKS endpoint.
 */
async function verifyJwtSignature(jwt) {
  const [headerB64, payloadB64, signatureB64] = jwt.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  // Fetch JWKS
  const { body: jwks } = await get('/.well-known/jwks.json');
  const key = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
  assert.ok(key, 'Could not find matching key in JWKS');

  // Build a Node.js crypto KeyObject from the JWK
  const { createPublicKey, verify } = await import('node:crypto');
  const keyObject = createPublicKey({ key: { kty: key.kty, n: key.n, e: key.e }, format: 'jwk' });

  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, 'base64url');

  const valid = verify('sha256', data, { key: keyObject, padding: 1 /* RSA_PKCS1_PADDING */ }, signature);
  return valid;
}

describe('Full OIDC Authorization Code Flow (End-to-End)', () => {
  let tokens;
  let idTokenPayload;

  it('Step 1 — Discovery: server exposes required OIDC metadata', async () => {
    const { status, body } = await get('/.well-known/openid-configuration');
    assert.equal(status, 200);
    assert.ok(body.issuer);
    assert.ok(body.authorization_endpoint);
    assert.ok(body.token_endpoint);
    assert.ok(body.userinfo_endpoint);
    assert.ok(body.jwks_uri);
  });

  it('Step 2 — JWKS: server exposes valid RSA public keys', async () => {
    const { status, body } = await get('/.well-known/jwks.json');
    assert.equal(status, 200);
    assert.ok(body.keys.length > 0);
    assert.equal(body.keys[0].kty, 'RSA');
  });

  it('Step 3 — Authorization: user authenticates and receives code (with PKCE)', async () => {
    const pkce = generatePKCE();

    const result = await loginAndGetCode({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: 'e2e-state',
      username: 'testuser',
      password: 'password123',
      ...pkce,
    });

    assert.equal(result.status, 302);
    assert.ok(result.code, 'Must receive authorization code');
    assert.equal(result.state, 'e2e-state', 'State must be echoed back');
  });

  it('Step 4 — Token: exchanges code for tokens', async () => {
    // We need fresh values since each it() is independent. Run the full flow again.
    const pkce = generatePKCE();
    const { code } = await loginAndGetCode({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: 'e2e-token-step',
      username: 'testuser',
      password: 'password123',
      ...pkce,
    });

    const { status, body } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: pkce.code_verifier,
    });

    assert.equal(status, 200, `Token exchange failed: ${JSON.stringify(body)}`);
    assert.ok(body.access_token, 'Must have access_token');
    assert.ok(body.id_token, 'Must have id_token');
    assert.equal(body.token_type, 'Bearer');
    assert.ok(body.expires_in > 0, 'expires_in must be positive');

    tokens = body;
  });

  it('Step 5 — ID Token: is a valid JWT with correct structure', async () => {
    // Run a fresh flow to get tokens
    const { code } = await loginAndGetCode({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: 'e2e-id-token',
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

    const parts = body.id_token.split('.');
    assert.equal(parts.length, 3, 'id_token must be a 3-part JWT');

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    assert.equal(header.alg, 'RS256', 'id_token must use RS256 algorithm');
    assert.ok(header.kid, 'id_token header must have kid');

    idTokenPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    assert.ok(idTokenPayload.sub, 'id_token must have sub');
    assert.ok(idTokenPayload.iss, 'id_token must have iss');
    assert.ok(idTokenPayload.aud, 'id_token must have aud');
    assert.ok(idTokenPayload.exp > Math.floor(Date.now() / 1000), 'id_token must not be expired');
    assert.ok(idTokenPayload.iat, 'id_token must have iat');
  });

  it('Step 6 — ID Token: RS256 signature verifies against JWKS', async () => {
    const { code } = await loginAndGetCode({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: 'e2e-sig-verify',
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

    const isValid = await verifyJwtSignature(body.id_token);
    assert.ok(isValid, 'id_token RS256 signature must be valid against the JWKS public key');
  });

  it('Step 7 — UserInfo: access_token grants access to user claims', async () => {
    const { code } = await loginAndGetCode({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: 'e2e-userinfo',
      username: 'testuser',
      password: 'password123',
    });
    const { body: tokenBody } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const { status, body: userinfo } = await get('/userinfo', {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });

    assert.equal(status, 200, `UserInfo returned ${status}: ${JSON.stringify(userinfo)}`);
    assert.ok(userinfo.sub, 'UserInfo must include sub');
  });

  it('Step 8 — Security: access_token cannot be reused as an authorization code', async () => {
    const { code } = await loginAndGetCode({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state: 'e2e-sec',
      username: 'testuser',
      password: 'password123',
    });
    const { body: tokenBody } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    // Attempt to use access_token as if it were an authorization code
    const { status } = await postForm('/oauth2/token', {
      grant_type: 'authorization_code',
      code: tokenBody.access_token,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    assert.equal(status, 400, 'access_token used as code must be rejected');
  });
});
