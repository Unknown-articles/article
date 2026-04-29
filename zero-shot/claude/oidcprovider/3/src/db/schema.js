import Database from 'better-sqlite3';
import { createHash, randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../oidc.db');

let _db;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

export function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL UNIQUE,
      client_secret TEXT NOT NULL,
      redirect_uris TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS authorization_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      code_challenge TEXT,
      code_challenge_method TEXT,
      used INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS jwks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kid TEXT NOT NULL UNIQUE,
      private_key TEXT NOT NULL,
      public_key TEXT NOT NULL,
      alg TEXT NOT NULL DEFAULT 'RS256',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Seed test client
  const existingClient = db.prepare('SELECT id FROM clients WHERE client_id = ?').get('test-client');
  if (!existingClient) {
    db.prepare(
      'INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)'
    ).run('test-client', 'test-secret', JSON.stringify([
      'http://localhost:8080/callback',
      'http://localhost:3001/callback',
    ]));
  }

  // Seed test user (password = sha256 of "password123")
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('testuser');
  if (!existingUser) {
    const hash = createHash('sha256').update('password123').digest('hex');
    db.prepare(
      'INSERT INTO users (username, password_hash, email, name) VALUES (?, ?, ?, ?)'
    ).run('testuser', hash, 'testuser@example.com', 'Test User');
  }

  return db;
}
