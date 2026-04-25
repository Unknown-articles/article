import crypto from 'crypto';
import { getDb } from '../db/index.js';

export function getUserByCredentials(username, password) {
  const db = getDb();
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  return db
    .prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
    .get(username, passwordHash) || null;
}

export function getUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
}
