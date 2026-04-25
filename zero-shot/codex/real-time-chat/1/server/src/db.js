import sqlite3 from "sqlite3";
import { config } from "./config.js";

sqlite3.verbose();

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
];

export const db = new sqlite3.Database(config.dbPath);

export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      for (const statement of schemaStatements) {
        db.run(statement, (error) => {
          if (error) {
            reject(error);
          }
        });
      }

      db.get("SELECT 1", (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });
}

export function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

export function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}
