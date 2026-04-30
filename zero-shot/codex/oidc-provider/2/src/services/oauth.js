import crypto from 'node:crypto';
import { SignJWT } from 'jose';
import { ACCESS_TOKEN_TTL_SECONDS, AUTH_CODE_TTL_SECONDS, ISSUER } from '../config.js';
import { get, run } from '../db.js';
import { getActivePrivateKey } from './keys.js';

export function randomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('base64url');
}

export function scopeIncludes(scope, required) {
  return String(scope || '').split(/\s+/).filter(Boolean).includes(required);
}

export async function findClient(clientId) {
  const client = await get('SELECT * FROM clients WHERE client_id = ?', [clientId]);
  if (!client) {
    return null;
  }
  return {
    ...client,
    redirect_uris: JSON.parse(client.redirect_uris)
  };
}

export function isRedirectUriAllowed(client, redirectUri) {
  return Boolean(client && client.redirect_uris.includes(redirectUri));
}

export async function findUserByCredentials(username, password) {
  return get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
}

export async function createAuthorizationCode({
  clientId,
  userId,
  redirectUri,
  scope,
  codeChallenge,
  codeChallengeMethod
}) {
  const code = randomToken(32);
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SECONDS;

  await run(
    `
      INSERT INTO authorization_codes
        (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [code, clientId, userId, redirectUri, scope, codeChallenge || null, codeChallengeMethod || null, expiresAt]
  );

  return code;
}

export async function findAuthorizationCode(code) {
  return get(
    `
      SELECT authorization_codes.*, users.email, users.name
      FROM authorization_codes
      JOIN users ON users.id = authorization_codes.user_id
      WHERE authorization_codes.code = ?
    `,
    [code]
  );
}

export async function markAuthorizationCodeUsed(code) {
  const now = Math.floor(Date.now() / 1000);
  return run('UPDATE authorization_codes SET used_at = ? WHERE code = ? AND used_at IS NULL', [now, code]);
}

export function pkceS256Challenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier || '').digest('base64url');
}

export async function createAccessToken({ clientId, userId, scope }) {
  const accessToken = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ACCESS_TOKEN_TTL_SECONDS;

  await run(
    `
      INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [accessToken, clientId, userId, scope, expiresAt, now]
  );

  return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function findAccessToken(accessToken) {
  return get(
    `
      SELECT tokens.*, users.email, users.name
      FROM tokens
      JOIN users ON users.id = tokens.user_id
      WHERE tokens.access_token = ?
    `,
    [accessToken]
  );
}

export async function createIdToken({ clientId, userId }) {
  const now = Math.floor(Date.now() / 1000);
  const { kid, key } = await getActivePrivateKey();

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(ISSUER)
    .setSubject(String(userId))
    .setAudience(clientId)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(key);
}
