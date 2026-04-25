import { get, run } from '../database/db.js';
import { badRequest, unauthorized } from '../utils/errors.js';
import { randomToken } from '../utils/random.js';
import { isoDateAfterSeconds } from '../utils/time.js';

const AUTHORIZATION_CODE_LIFETIME_SECONDS = 300;

export async function createAuthorizationCode(database, payload) {
  const code = randomToken(32);
  const expiresAt = isoDateAfterSeconds(AUTHORIZATION_CODE_LIFETIME_SECONDS);

  await run(
    database,
    `
      INSERT INTO authorization_codes (
        code,
        client_id,
        user_id,
        redirect_uri,
        scope,
        code_challenge,
        code_challenge_method,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      code,
      payload.clientId,
      payload.userId,
      payload.redirectUri,
      payload.scope,
      payload.codeChallenge ?? null,
      payload.codeChallengeMethod ?? null,
      expiresAt,
    ],
  );

  return {
    code,
    expiresAt,
  };
}

export async function findAuthorizationCode(database, code) {
  const row = await get(database, 'SELECT * FROM authorization_codes WHERE code = ?', [code]);
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    clientId: row.client_id,
    userId: row.user_id,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

export async function consumeAuthorizationCode(database, code) {
  await run(
    database,
    'UPDATE authorization_codes SET consumed_at = CURRENT_TIMESTAMP WHERE code = ? AND consumed_at IS NULL',
    [code],
  );
}

export function validateAuthorizationRequest({ client, query }) {
  if (query.response_type !== 'code') {
    throw badRequest('unsupported_response_type', 'Only response_type=code is supported');
  }

  if (!query.redirect_uri || !client.redirectUris.includes(query.redirect_uri)) {
    throw badRequest('invalid_request', 'The redirect_uri must match a registered client redirect URI');
  }

  const scope = query.scope ?? '';
  const requestedScopes = scope.split(' ').filter(Boolean);

  if (!requestedScopes.includes('openid')) {
    throw badRequest('invalid_scope', 'The openid scope is required for OpenID Connect');
  }

  const invalidScope = requestedScopes.find((item) => !client.scopes.includes(item));
  if (invalidScope) {
    throw badRequest('invalid_scope', `Scope ${invalidScope} is not allowed for this client`);
  }

  if (query.code_challenge_method && query.code_challenge_method !== 'S256') {
    throw badRequest('invalid_request', 'Only the S256 PKCE code_challenge_method is supported');
  }

  if (query.code_challenge_method && !query.code_challenge) {
    throw badRequest('invalid_request', 'A code_challenge is required when code_challenge_method is provided');
  }
}

export function requireAuthenticatedUser(user) {
  if (!user) {
    throw unauthorized('login_required', 'Valid mock user credentials are required to authorize');
  }
}
