import sqlite3 from 'sqlite3';

export const DB_PATH = process.env.DB_PATH || './chat.db';

export function initializeDatabase(databasePath = DB_PATH) {
  const sqliteConnection = new sqlite3.Database(databasePath);

  return new Promise((resolve, reject) => {
    sqliteConnection.serialize(() => {
      sqliteConnection.run(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )`,
        (usersTableError) => {
          if (usersTableError) {
            sqliteConnection.close();
            reject(usersTableError);
            return;
          }

          sqliteConnection.run(
            `CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              username TEXT NOT NULL,
              content TEXT NOT NULL,
              timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )`,
            (messagesTableError) => {
              if (messagesTableError) {
                sqliteConnection.close();
                reject(messagesTableError);
                return;
              }

              resolve(sqliteConnection);
            }
          );
        }
      );
    });
  });
}
