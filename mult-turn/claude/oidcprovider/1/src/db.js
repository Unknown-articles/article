import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data.db');

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email    TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS clients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id      TEXT UNIQUE NOT NULL,
    client_secret  TEXT NOT NULL,
    redirect_uris  TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS auth_codes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    code                  TEXT UNIQUE NOT NULL,
    client_id             TEXT NOT NULL,
    user_id               INTEGER NOT NULL,
    redirect_uri          TEXT NOT NULL,
    scope                 TEXT NOT NULL,
    code_challenge        TEXT,
    code_challenge_method TEXT,
    expires_at            INTEGER NOT NULL,
    used                  INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tokens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT UNIQUE NOT NULL,
    client_id    TEXT NOT NULL,
    user_id      INTEGER NOT NULL,
    scope        TEXT NOT NULL,
    expires_at   INTEGER NOT NULL
  )`);

  const existingClient = await get(
    'SELECT id FROM clients WHERE client_id = ?',
    ['test-client']
  );
  if (!existingClient) {
    await run(
      'INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)',
      [
        'test-client',
        'test-secret',
        JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback']),
      ]
    );
  }

  const existingUser = await get(
    'SELECT id FROM users WHERE username = ?',
    ['testuser']
  );
  if (!existingUser) {
    await run(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      ['testuser', 'password123', 'testuser@example.com']
    );
  }
}

export default db;
