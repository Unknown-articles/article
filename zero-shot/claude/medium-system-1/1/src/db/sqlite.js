import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DB_PATH } from '../config.js';

const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS clients (
    client_id    TEXT PRIMARY KEY,
    client_secret TEXT,
    redirect_uri TEXT NOT NULL,
    name         TEXT
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    code                  TEXT PRIMARY KEY,
    client_id             TEXT NOT NULL,
    user_id               TEXT NOT NULL,
    code_challenge        TEXT,
    code_challenge_method TEXT DEFAULT 'S256',
    scope                 TEXT,
    expires_at            INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tokens (
    access_token TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    client_id    TEXT NOT NULL,
    scope        TEXT,
    expires_at   INTEGER NOT NULL
  );
`);

// ─── Seed ──────────────────────────────────────────────────────────────────────

export async function seedDatabase() {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com');
  if (!exists) {
    const adminHash = await bcrypt.hash('admin123', 10);
    db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), 'admin@example.com', adminHash, 'admin');

    const userHash = await bcrypt.hash('user123', 10);
    db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), 'user@example.com', userHash, 'user');

    console.log('Seeded users  : admin@example.com / admin123 | user@example.com / user123');
  }

  const existsClient = db.prepare('SELECT client_id FROM clients WHERE client_id = ?').get('demo-client');
  if (!existsClient) {
    db.prepare('INSERT INTO clients (client_id, redirect_uri, name) VALUES (?, ?, ?)')
      .run('demo-client', 'http://localhost:3000/callback', 'Demo Client');

    console.log('Seeded client : demo-client → http://localhost:3000/callback');
  }
}

export default db;
