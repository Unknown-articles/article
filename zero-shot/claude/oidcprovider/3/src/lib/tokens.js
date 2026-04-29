import { SignJWT } from 'jose';
import { randomBytes, createPrivateKey } from 'crypto';
import { getActivePrivateKey } from './keys.js';
import { getDb } from '../db/schema.js';

function getIssuer() {
  return process.env.ISSUER || `http://localhost:${process.env.PORT || 3000}`;
}

export async function signIdToken({ sub, clientId, scope, extraClaims = {} }) {
  const { kid, key } = getActivePrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: String(sub),
    iss: getIssuer(),
    aud: clientId,
    iat: now,
    exp: now + 3600,
    ...extraClaims,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid })
    .sign(key);
}

export function generateAccessToken({ clientId, userId, scope }) {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  db.prepare(
    'INSERT INTO access_tokens (token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(token, clientId, userId, scope, expiresAt);

  return { token, expiresAt };
}

export function validateAccessToken(token) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(
    'SELECT * FROM access_tokens WHERE token = ? AND expires_at > ?'
  ).get(token, now);
}
