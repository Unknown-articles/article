import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '..', 'data.db');

const store = new sqlite3.Database(STORE_PATH);

function runStatement(sql, params = []) {
  return new Promise((resolve, reject) => {
    store.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    store.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export async function initializeDatabase() {
  await runStatement(`CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email    TEXT NOT NULL
  )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS clients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id      TEXT UNIQUE NOT NULL,
    client_secret  TEXT NOT NULL,
    redirect_uris  TEXT NOT NULL
  )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS auth_codes (
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

  await runStatement(`CREATE TABLE IF NOT EXISTS tokens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT UNIQUE NOT NULL,
    client_id    TEXT NOT NULL,
    user_id      INTEGER NOT NULL,
    scope        TEXT NOT NULL,
    expires_at   INTEGER NOT NULL
  )`);

  const clientRecord = await getRow(
    'SELECT id FROM clients WHERE client_id = ?',
    ['test-client']
  );
  if (!clientRecord) {
    await runStatement(
      'INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)',
      [
        'test-client',
        'test-secret',
        JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback']),
      ]
    );
  }

  const userRecord = await getRow(
    'SELECT id FROM users WHERE username = ?',
    ['testuser']
  );
  if (!userRecord) {
    await runStatement(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      ['testuser', 'password123', 'testuser@example.com']
    );
  }
}

export default store;
