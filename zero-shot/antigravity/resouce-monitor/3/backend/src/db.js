import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const dbPath = process.env.DB_PATH || './chat.db';

// Promisify sqlite3
export class Database {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

const db = new Database(dbPath);

export async function initDb() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
}

export default db;
