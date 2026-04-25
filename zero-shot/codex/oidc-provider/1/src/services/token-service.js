import { SignJWT } from 'jose';
import { config } from '../config/index.js';
import { get, run } from '../db/sqlite.js';
import { createRandomToken, sha256Base64Url } from '../utils/encoding.js';
import { getActiveSigningKey } from './key-service.js';

export function extractClientCredentials(req) {
  const header = req.headers.authorization;

  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return { clientId: '', clientSecret: '' };
    }

    return {
      clientId: decoded.slice(0, separatorIndex),
      clientSecret: decoded.slice(separatorIndex + 1),
    };
  }

  return {
    clientId: req.body.client_id,
    clientSecret: req.body.client_secret,
  };
}

export async function authenticateClient(clientId, clientSecret) {
  if (!clientId) {
    return null;
  }

  const client = await get(
    'SELECT id, client_id, client_secret FROM clients WHERE client_id = ?',
    [clientId],
  );

  if (!client || client.client_secret !== clientSecret) {
    return null;
  }

  return client;
}

export function validateTokenRequestShape(body) {
  if (!body.grant_type) {
    return { status: 400, error: 'invalid_request', message: 'grant_type is required.' };
  }

  if (body.grant_type !== 'authorization_code') {
    return {
      status: 400,
      error: 'unsupported_grant_type',
      message: 'grant_type must be authorization_code.',
    };
  }

  if (!body.code) {
    return { status: 400, error: 'invalid_request', message: 'code is required.' };
  }

  if (!body.redirect_uri) {
    return { status: 400, error: 'invalid_request', message: 'redirect_uri is required.' };
  }

  return null;
}

export function validatePkce(authCode, codeVerifier) {
  if (!authCode.code_challenge) {
    return true;
  }

  if (authCode.code_challenge_method !== 'S256') {
    return false;
  }

  if (!codeVerifier) {
    return false;
  }

  return sha256Base64Url(codeVerifier) === authCode.code_challenge;
}

export async function markAuthorizationCodeConsumed(id) {
  await run(
    `UPDATE authorization_codes
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id],
  );
}

export async function issueTokens({ client, authCode }) {
  const accessToken = createRandomToken(32);
  const expiresAt = new Date(
    Date.now() + config.accessTokenTtlSeconds * 1000,
  ).toISOString();

  await run(
    `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [accessToken, client.id, authCode.user_id, authCode.scope, expiresAt],
  );

  const signingKey = await getActiveSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const idToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: signingKey.kid })
    .setIssuer(config.issuer)
    .setAudience(client.client_id)
    .setSubject(authCode.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + config.idTokenTtlSeconds)
    .sign(signingKey.privateKey);

  return {
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: config.accessTokenTtlSeconds,
  };
}
