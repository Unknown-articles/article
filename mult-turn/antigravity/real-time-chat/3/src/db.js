import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const dbPath = process.env.DB_PATH || './chat.db';

let dbInstance;

export async function initDb() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS chatHistory (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL,
      username  TEXT NOT NULL,
      content   TEXT NOT NULL,
      timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `);

  dbInstance = db;
  return db;
}

export function getDb() {
  if (!dbInstance) throw new Error("Database not initialized");
  return dbInstance;
}

