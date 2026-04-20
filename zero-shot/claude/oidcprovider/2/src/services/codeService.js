import { randomBytes, createHash } from 'crypto';
import { getDb } from '../db/index.js';
import config from '../config/index.js';

export function generateAuthCode(clientId, userId, redirectUri, scope, codeChallenge, codeChallengeMethod) {
  const db = getDb();
  const code = randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + config.AUTH_CODE_TTL;
  db.prepare(`
    INSERT INTO authorization_codes (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, clientId, userId, redirectUri, scope, codeChallenge || null, codeChallengeMethod || null, expiresAt);
  return code;
}

export function lookupAuthCode(code) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM authorization_codes WHERE code = ?').get(code);
  if (!row) return { error: 'invalid' };
  if (row.used) return { error: 'replay' };
  if (row.expires_at < now) return { error: 'expired' };
  return { code: row };
}

export function markCodeUsed(code) {
  const db = getDb();
  db.prepare('UPDATE authorization_codes SET used = 1 WHERE code = ?').run(code);
}

export function verifyPkce(storedChallenge, verifier) {
  const hash = createHash('sha256').update(verifier).digest();
  const computed = hash.toString('base64url');
  return computed === storedChallenge;
}
