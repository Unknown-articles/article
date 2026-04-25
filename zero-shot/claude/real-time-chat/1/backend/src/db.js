import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';

const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    UNIQUE NOT NULL,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    username  TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    timestamp TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export default db;
