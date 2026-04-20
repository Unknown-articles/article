import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get } from '../helpers/http.js';

describe('GET /.well-known/jwks.json (JWKS Endpoint)', () => {
  it('responds with HTTP 200', async () => {
    const { status } = await get('/.well-known/jwks.json');
    assert.equal(status, 200, `Expected 200, got ${status}`);
  });

  it('returns Content-Type: application/json', async () => {
    const { headers } = await get('/.well-known/jwks.json');
    assert.ok(
      headers.get('content-type')?.includes('application/json'),
      `Content-Type should be application/json, got: ${headers.get('content-type')}`
    );
  });

  it('response has a "keys" array', async () => {
    const { body } = await get('/.well-known/jwks.json');
    assert.ok(Object.hasOwn(body, 'keys'), 'Response must have a "keys" property');
    assert.ok(Array.isArray(body.keys), '"keys" must be an array');
  });

  it('contains at least one key', async () => {
    const { body } = await get('/.well-known/jwks.json');
    assert.ok(body.keys.length > 0, 'JWKS must contain at least one key');
  });

  it('keys use RSA key type (kty: RSA)', async () => {
    const { body } = await get('/.well-known/jwks.json');
    for (const key of body.keys) {
      assert.equal(key.kty, 'RSA', `Key must have kty=RSA, got: ${key.kty}`);
    }
  });

  it('keys have required RSA public key fields (n, e)', async () => {
    const { body } = await get('/.well-known/jwks.json');
    for (const key of body.keys) {
      assert.ok(key.n, 'RSA key must have "n" (modulus)');
      assert.ok(key.e, 'RSA key must have "e" (exponent)');
    }
  });

  it('keys have a "use" field set to "sig"', async () => {
    const { body } = await get('/.well-known/jwks.json');
    for (const key of body.keys) {
      assert.equal(key.use, 'sig', `Key "use" must be "sig", got: ${key.use}`);
    }
  });

  it('keys have an "alg" field set to RS256', async () => {
    const { body } = await get('/.well-known/jwks.json');
    for (const key of body.keys) {
      assert.equal(key.alg, 'RS256', `Key "alg" must be RS256, got: ${key.alg}`);
    }
  });

  it('keys have a "kid" (key ID) field', async () => {
    const { body } = await get('/.well-known/jwks.json');
    for (const key of body.keys) {
      assert.ok(key.kid, 'Key must have a "kid" (key ID)');
    }
  });
});
