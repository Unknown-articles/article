import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index.js';

export function initializeSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT    PRIMARY KEY,
      username     TEXT    UNIQUE NOT NULL,
      password_hash TEXT   NOT NULL,
      email        TEXT    UNIQUE NOT NULL,
      name         TEXT    NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS clients (
      id             TEXT    PRIMARY KEY,
      client_secret  TEXT    NOT NULL,
      name           TEXT    NOT NULL,
      redirect_uris  TEXT    NOT NULL,
      scopes         TEXT    NOT NULL,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS authorization_codes (
      code                  TEXT    PRIMARY KEY,
      client_id             TEXT    NOT NULL,
      user_id               TEXT    NOT NULL,
      redirect_uri          TEXT    NOT NULL,
      scope                 TEXT    NOT NULL,
      code_challenge        TEXT,
      code_challenge_method TEXT,
      expires_at            INTEGER NOT NULL,
      used                  INTEGER NOT NULL DEFAULT 0,
      created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (user_id)   REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id           TEXT    PRIMARY KEY,
      access_token TEXT    UNIQUE NOT NULL,
      token_type   TEXT    NOT NULL DEFAULT 'Bearer',
      client_id    TEXT    NOT NULL,
      user_id      TEXT    NOT NULL,
      scope        TEXT    NOT NULL,
      expires_at   INTEGER NOT NULL,
      revoked      INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (user_id)   REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS signing_keys (
      id          TEXT    PRIMARY KEY,
      private_key TEXT    NOT NULL,
      public_key  TEXT    NOT NULL,
      algorithm   TEXT    NOT NULL DEFAULT 'RS256',
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

export function seedData() {
  const db = getDb();

  // Seed a default test user (password: password123)
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('testuser');
  if (!existingUser) {
    const passwordHash = crypto.createHash('sha256').update('password123').digest('hex');
    db.prepare(`
      INSERT INTO users (id, username, password_hash, email, name)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), 'testuser', passwordHash, 'testuser@example.com', 'Test User');
    console.log('Seeded test user: testuser / password123');
  }

  // Seed a default test client
  const existingClient = db.prepare('SELECT id FROM clients WHERE id = ?').get('test-client');
  if (!existingClient) {
    db.prepare(`
      INSERT INTO clients (id, client_secret, name, redirect_uris, scopes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'test-client',
      'test-secret',
      'Test Client Application',
      JSON.stringify([
        'http://localhost:8080/callback',
        'http://localhost:3001/callback',
        'http://127.0.0.1:8080/callback',
      ]),
      JSON.stringify(['openid', 'profile', 'email'])
    );
    console.log('Seeded test client: test-client / test-secret');
  }
}
