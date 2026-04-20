import { get, run } from '../db/sqlite.js';
import { createRandomToken } from '../utils/encoding.js';
import { findClientByClientId } from './client-service.js';

const authCodeLifetimeMs = 10 * 60 * 1000;

export async function validateAuthorizationRequest(params) {
  const clientId = params.client_id?.trim();
  const redirectUri = params.redirect_uri?.trim();
  const responseType = params.response_type?.trim();
  const scope = params.scope?.trim();

  if (!clientId) {
    return { valid: false, error: 'invalid_request', message: 'client_id is required.' };
  }

  const client = await findClientByClientId(clientId);

  if (!client) {
    return { valid: false, error: 'invalid_client', message: 'Unknown client_id.' };
  }

  if (!redirectUri) {
    return { valid: false, error: 'invalid_request', message: 'redirect_uri is required.' };
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return { valid: false, error: 'invalid_request', message: 'redirect_uri is not registered for this client.' };
  }

  if (!responseType || responseType !== 'code') {
    return {
      valid: false,
      error: 'unsupported_response_type',
      message: 'response_type must be code.',
    };
  }

  if (!scope || !scope.split(/\s+/).includes('openid')) {
    return { valid: false, error: 'invalid_scope', message: 'scope must include openid.' };
  }

  if (
    params.code_challenge_method &&
    params.code_challenge_method !== 'S256'
  ) {
    return {
      valid: false,
      error: 'invalid_request',
      message: 'code_challenge_method must be S256 when provided.',
    };
  }

  if (params.code_challenge_method === 'S256' && !params.code_challenge) {
    return {
      valid: false,
      error: 'invalid_request',
      message: 'code_challenge is required when code_challenge_method is S256.',
    };
  }

  return { valid: true, client };
}

export async function createAuthorizationCode({
  client,
  user,
  redirectUri,
  scope,
  state,
  codeChallenge,
  codeChallengeMethod,
}) {
  const code = createRandomToken(32);
  const expiresAt = new Date(Date.now() + authCodeLifetimeMs).toISOString();

  await run(
    `INSERT INTO authorization_codes
     (code, client_id, user_id, redirect_uri, scope, state, code_challenge, code_challenge_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      client.id,
      user.id,
      redirectUri,
      scope,
      state ?? null,
      codeChallenge ?? null,
      codeChallengeMethod ?? null,
      expiresAt,
    ],
  );

  return code;
}

export async function findAuthorizationCode(code) {
  return get(
    `SELECT
       ac.id,
       ac.code,
       ac.redirect_uri,
       ac.scope,
       ac.state,
       ac.code_challenge,
       ac.code_challenge_method,
       ac.expires_at,
       ac.consumed_at,
       c.id AS client_id,
       c.client_id AS client_identifier,
       u.id AS user_id,
       u.sub,
       u.email,
       u.name
     FROM authorization_codes ac
     INNER JOIN clients c ON c.id = ac.client_id
     INNER JOIN users u ON u.id = ac.user_id
     WHERE ac.code = ?`,
    [code],
  );
}
