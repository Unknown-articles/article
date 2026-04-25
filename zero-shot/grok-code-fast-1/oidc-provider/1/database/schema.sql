-- Database schema for OIDC Provider

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT NOT NULL -- JSON array
);

CREATE TABLE IF NOT EXISTS authorization_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  state TEXT,
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients(client_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT UNIQUE NOT NULL,
  id_token TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(client_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);