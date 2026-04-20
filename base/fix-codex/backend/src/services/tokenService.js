import db from '../db/sqliteDb.js';

function findValidTokenRow(accessToken) {
  const row = db.prepare('SELECT * FROM tokens WHERE access_token = ?').get(accessToken);
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row;
}

export function getUserByAccessToken(accessToken) {
  if (!accessToken) return null;
  const row = findValidTokenRow(accessToken);
  if (!row) return null;
  return db.prepare('SELECT id,username,email FROM users WHERE id = ?').get(row.user_id) || null;
}

export function readBearerToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
