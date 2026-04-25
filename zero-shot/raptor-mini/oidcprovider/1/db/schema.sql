-- OIDC Provider database schema and seed data

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authorization_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  scope TEXT NOT NULL,
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Seed data for test client and user.

INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris)
VALUES ('test-client', 'test-secret', '["http://localhost:8080/callback", "http://localhost:3001/callback"]');

-- password_hash values are generated dynamically in the application using scrypt.
