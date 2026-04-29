export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      kid       TEXT PRIMARY KEY,
      public_key  TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clients (
      client_id     TEXT PRIMARY KEY,
      client_secret TEXT NOT NULL,
      redirect_uris TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id       TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email    TEXT NOT NULL,
      name     TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      code                   TEXT PRIMARY KEY,
      client_id              TEXT NOT NULL,
      user_id                TEXT NOT NULL,
      redirect_uri           TEXT NOT NULL,
      scope                  TEXT NOT NULL,
      code_challenge         TEXT,
      code_challenge_method  TEXT,
      expires_at             INTEGER NOT NULL,
      used                   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tokens (
      access_token TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      client_id    TEXT NOT NULL,
      scope        TEXT NOT NULL,
      expires_at   INTEGER NOT NULL
    );
  `);
}
