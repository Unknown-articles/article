import { db } from './db.js';

export function listRecentMessages(limit = 50) {
  return db
    .prepare(`
      SELECT
        id,
        user_id AS userId,
        username,
        content,
        timestamp
      FROM messages
      ORDER BY id DESC
      LIMIT ?
    `)
    .all(limit)
    .reverse();
}

export function createMessage({ userId, username, content }) {
  return db
    .prepare(`
      INSERT INTO messages (user_id, username, content)
      VALUES (?, ?, ?)
      RETURNING
        id,
        user_id AS userId,
        username,
        content,
        timestamp
    `)
    .get(userId, username, content);
}
