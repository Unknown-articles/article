import sqlite3 from "sqlite3";

const DB_PATH = process.env.DB_PATH || "./chat.db";
let db;

const usersTable = `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)`;

const messagesTable = `CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)`;

export function prepareDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(
      DB_PATH,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (openError) => {
        if (openError) {
          reject(openError);
          return;
        }

        db.serialize(() => {
          db.run(usersTable, (usersError) => {
            if (usersError) {
              reject(usersError);
              return;
            }

            db.run(messagesTable, (messagesError) => {
              if (messagesError) {
                reject(messagesError);
                return;
              }

              resolve(db);
            });
          });
        });
      }
    );
  });
}

export function databaseInstance() {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  return db;
}

export function selectOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    databaseInstance().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

export function selectAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    databaseInstance().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

export function executeStatement(sql, params = []) {
  return new Promise((resolve, reject) => {
    databaseInstance().run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}
