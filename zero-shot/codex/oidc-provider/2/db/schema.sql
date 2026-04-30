PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signing_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kid TEXT NOT NULL UNIQUE,
  private_jwk TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
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
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
