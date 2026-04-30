import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbFile = join(__dirname, '../data/oidc.sqlite');

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbFile);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const initDb = async () => {
  await run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    sub TEXT UNIQUE NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS authorization_codes (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    code_challenge TEXT,
    code_challenge_method TEXT,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    state TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY,
    access_token TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS jwks (
    id INTEGER PRIMARY KEY,
    kid TEXT UNIQUE NOT NULL,
    private_key_pem TEXT NOT NULL,
    public_jwk TEXT NOT NULL,
    use_current INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);

  const client = await get('SELECT * FROM clients WHERE client_id = ?', ['test-client']);
  if (!client) {
    await run('INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)', [
      'test-client',
      'test-secret',
      JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback'])
    ]);
  }

  const user = await get('SELECT * FROM users WHERE username = ?', ['testuser']);
  if (!user) {
    await run('INSERT INTO users (username, password, email, sub) VALUES (?, ?, ?, ?)', [
      'testuser',
      'password123',
      'testuser@example.com',
      'testuser'
    ]);
  }
};

export { db, run, get, all, initDb };
