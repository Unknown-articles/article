import sqlite3 from 'sqlite3';

export const DB_PATH = process.env.DB_PATH || './chat.db';

export function initializeDatabase(dbPath = DB_PATH) {
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )`,
        (usersError) => {
          if (usersError) {
            db.close();
            reject(usersError);
            return;
          }

          db.run(
            `CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              username TEXT NOT NULL,
              content TEXT NOT NULL,
              timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )`,
            (messagesError) => {
              if (messagesError) {
                db.close();
                reject(messagesError);
                return;
              }

              resolve(db);
            }
          );
        }
      );
    });
  });
}
