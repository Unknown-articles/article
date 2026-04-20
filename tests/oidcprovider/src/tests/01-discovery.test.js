import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get } from '../helpers/http.js';

const REQUIRED_FIELDS = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'userinfo_endpoint',
  'jwks_uri',
  'response_types_supported',
  'subject_types_supported',
  'id_token_signing_alg_values_supported',
];

describe('GET /.well-known/openid-configuration (Discovery Endpoint)', () => {
  let discovery;

  it('responds with HTTP 200', async () => {
    const { status, body } = await get('/.well-known/openid-configuration');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    discovery = body;
  });

  it('returns Content-Type: application/json', async () => {
    const { headers } = await get('/.well-known/openid-configuration');
    assert.ok(
      headers.get('content-type')?.includes('application/json'),
      `Content-Type should be application/json, got: ${headers.get('content-type')}`
    );
  });

  it('contains all required OIDC metadata fields', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    for (const field of REQUIRED_FIELDS) {
      assert.ok(Object.hasOwn(body, field), `Missing required field: ${field}`);
    }
  });

  it('issuer is a valid HTTPS or HTTP URL', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(
      body.issuer.startsWith('http://') || body.issuer.startsWith('https://'),
      `issuer should be a URL, got: ${body.issuer}`
    );
  });

  it('authorization_endpoint points to /oauth2/authorize', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(
      body.authorization_endpoint.includes('/oauth2/authorize'),
      `authorization_endpoint should include /oauth2/authorize, got: ${body.authorization_endpoint}`
    );
  });

  it('token_endpoint points to /oauth2/token', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(
      body.token_endpoint.includes('/oauth2/token'),
      `token_endpoint should include /oauth2/token, got: ${body.token_endpoint}`
    );
  });

  it('userinfo_endpoint points to /userinfo', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(
      body.userinfo_endpoint.includes('/userinfo'),
      `userinfo_endpoint should include /userinfo, got: ${body.userinfo_endpoint}`
    );
  });

  it('jwks_uri points to /.well-known/jwks.json', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(
      body.jwks_uri.includes('jwks.json') || body.jwks_uri.includes('jwks'),
      `jwks_uri should reference JWKS, got: ${body.jwks_uri}`
    );
  });

  it('response_types_supported is an array containing "code"', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(Array.isArray(body.response_types_supported), 'response_types_supported must be an array');
    assert.ok(
      body.response_types_supported.includes('code'),
      `response_types_supported must include "code", got: ${JSON.stringify(body.response_types_supported)}`
    );
  });

  it('subject_types_supported is an array', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(Array.isArray(body.subject_types_supported), 'subject_types_supported must be an array');
    assert.ok(body.subject_types_supported.length > 0, 'subject_types_supported must not be empty');
  });

  it('id_token_signing_alg_values_supported contains RS256', async () => {
    const { body } = await get('/.well-known/openid-configuration');
    assert.ok(
      Array.isArray(body.id_token_signing_alg_values_supported),
      'id_token_signing_alg_values_supported must be an array'
    );
    assert.ok(
      body.id_token_signing_alg_values_supported.includes('RS256'),
      `id_token_signing_alg_values_supported must include RS256, got: ${JSON.stringify(body.id_token_signing_alg_values_supported)}`
    );
  });
});
