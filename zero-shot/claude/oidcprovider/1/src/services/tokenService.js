import { randomBytes } from 'crypto';
import { getDb } from '../db/index.js';
import config from '../config/index.js';

export function generateAccessToken(clientId, userId, scope) {
  const db = getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + config.ACCESS_TOKEN_TTL;
  db.prepare(`
    INSERT INTO access_tokens (token, client_id, user_id, scope, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, clientId, userId, scope, expiresAt);
  return { token, expiresAt };
}

export function validateAccessToken(token) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM access_tokens WHERE token = ? AND expires_at > ?').get(token, now);
  return row || null;
}
