import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

export async function initDb() {
  db = await open({
    filename: './db/oidc.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE,
      client_secret TEXT,
      redirect_uris TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT,
      user_id INTEGER,
      redirect_uri TEXT,
      scope TEXT,
      expires_at INTEGER,
      code_challenge TEXT,
      code_challenge_method TEXT
    );

    CREATE TABLE IF NOT EXISTS tokens (
      access_token TEXT PRIMARY KEY,
      id_token TEXT,
      refresh_token TEXT,
      client_id TEXT,
      user_id INTEGER,
      expires_at INTEGER
    );
  `);

  // Insert default user and client
  await db.run('INSERT OR IGNORE INTO users (username, email, name) VALUES (?, ?, ?)', ['user1', 'user@example.com', 'User']);
  await db.run('INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)', ['client1', 'secret', JSON.stringify(['http://localhost:3001/callback'])]);

  return db;
}

export { db };