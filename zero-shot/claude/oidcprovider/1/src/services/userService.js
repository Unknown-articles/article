import { getDb } from '../db/index.js';

export function getUserByCredentials(username, password) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
}

export function getUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}
