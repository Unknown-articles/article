import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();

export const db = new sqlite.Database(process.env.DB_PATH ?? 'oidc.sqlite');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

export async function findClientByClientId(clientId) {
  return get('SELECT * FROM clients WHERE client_id = ?', [clientId]);
}

export async function findUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

export async function findUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

export async function createAuthorizationCode({
  code,
  clientId,
  userId,
  redirectUri,
  scope,
  codeChallenge = null,
  codeChallengeMethod = null,
  expiresAt,
}) {
  return run(
    `
      INSERT INTO auth_codes (
        code,
        client_id,
        user_id,
        redirect_uri,
        scope,
        code_challenge,
        code_challenge_method,
        expires_at,
        used
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    [code, clientId, userId, redirectUri, scope, codeChallenge, codeChallengeMethod, expiresAt],
  );
}

export async function findAuthorizationCode(code) {
  return get('SELECT * FROM auth_codes WHERE code = ?', [code]);
}

export async function markAuthorizationCodeUsed(id) {
  return run('UPDATE auth_codes SET used = 1 WHERE id = ?', [id]);
}

export async function createToken({ accessToken, clientId, userId, scope, expiresAt }) {
  return run(
    `
      INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [accessToken, clientId, userId, scope, expiresAt],
  );
}

export async function findToken(accessToken) {
  return get('SELECT * FROM tokens WHERE access_token = ?', [accessToken]);
}

export async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      email     TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS clients (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id      TEXT UNIQUE NOT NULL,
      client_secret  TEXT NOT NULL,
      redirect_uris  TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auth_codes (
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
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token  TEXT UNIQUE NOT NULL,
      client_id     TEXT NOT NULL,
      user_id       INTEGER NOT NULL,
      scope         TEXT NOT NULL,
      expires_at    INTEGER NOT NULL
    )
  `);

  await run(
    `
      INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris)
      VALUES (?, ?, ?)
    `,
    [
      'test-client',
      'test-secret',
      JSON.stringify([
        'http://localhost:8080/callback',
        'http://localhost:3001/callback',
      ]),
    ],
  );

  await run(
    `
      INSERT OR IGNORE INTO users (username, password, email)
      VALUES (?, ?, ?)
    `,
    ['testuser', 'password123', 'testuser@example.com'],
  );
}
