import crypto from 'crypto';
import { getDb } from '../db/index.js';
import config from '../config/index.js';

export function createAuthCode({ clientId, userId, redirectUri, scope, codeChallenge, codeChallengeMethod }) {
  const db = getDb();
  const code = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + config.authCodeExpiresIn;

  db.prepare(`
    INSERT INTO authorization_codes
      (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code, clientId, userId, redirectUri, scope,
    codeChallenge || null, codeChallengeMethod || null,
    expiresAt
  );

  return code;
}

export function getAuthCode(code) {
  const db = getDb();
  return db.prepare('SELECT * FROM authorization_codes WHERE code = ?').get(code) || null;
}

export function consumeAuthCode(code) {
  const db = getDb();
  db.prepare('UPDATE authorization_codes SET used = 1 WHERE code = ?').run(code);
}

/**
 * Validate PKCE per RFC 7636.
 * Returns true if PKCE passes (or was not requested).
 */
export function validatePKCE(codeChallenge, codeChallengeMethod, codeVerifier) {
  if (!codeChallenge) return true; // PKCE not used for this code

  if (!codeVerifier) return false;

  if (codeChallengeMethod === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }

  if (codeChallengeMethod === 'plain') {
    return codeVerifier === codeChallenge;
  }

  return false;
}
