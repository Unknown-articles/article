import db from '../db/sqliteDb.js';

export function validateAccessToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM tokens WHERE access_token = ?').get(token);
  if (!row || new Date(row.expires_at) < new Date()) return null;
  const user = db.prepare('SELECT id,username,email FROM users WHERE id = ?').get(row.user_id);
  return user || null;
}
