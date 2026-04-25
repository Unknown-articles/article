import { get } from '../db/sqlite.js';

export async function authenticateUser(username, password) {
  return get(
    `SELECT id, sub, username, email, name
     FROM users
     WHERE username = ? AND password = ?`,
    [username, password],
  );
}
