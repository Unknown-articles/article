import sqlite3 from 'sqlite3';

const sqliteEngine = sqlite3.verbose();

export const databaseConnection = new sqliteEngine.Database(process.env.DB_PATH ?? 'oidc.sqlite');

function executeStatement(sqlText, values = []) {
  return new Promise((resolve, reject) => {
    databaseConnection.run(sqlText, values, function onExecute(runError) {
      if (runError) {
        reject(runError);
        return;
      }

      resolve(this);
    });
  });
}

function fetchSingleRow(sqlText, values = []) {
  return new Promise((resolve, reject) => {
    databaseConnection.get(sqlText, values, (queryError, foundRow) => {
      if (queryError) {
        reject(queryError);
        return;
      }

      resolve(foundRow);
    });
  });
}

export async function loadClientByClientId(clientIdentifier) {
  return fetchSingleRow('SELECT * FROM clients WHERE client_id = ?', [clientIdentifier]);
}

export async function loadUserByUsername(usernameValue) {
  return fetchSingleRow('SELECT * FROM users WHERE username = ?', [usernameValue]);
}

export async function loadUserById(userId) {
  return fetchSingleRow('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function storeAuthorizationCode({
  code: authorizationCode,
  clientId: clientIdentifier,
  userId: ownerUserId,
  redirectUri: callbackUrl,
  scope: grantedScope,
  codeChallenge: pkceChallenge = null,
  codeChallengeMethod: pkceMethod = null,
  expiresAt: expirationTimestamp,
}) {
  return executeStatement(
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
    [
      authorizationCode,
      clientIdentifier,
      ownerUserId,
      callbackUrl,
      grantedScope,
      pkceChallenge,
      pkceMethod,
      expirationTimestamp,
    ],
  );
}

export async function loadAuthorizationCode(authorizationCode) {
  return fetchSingleRow('SELECT * FROM auth_codes WHERE code = ?', [authorizationCode]);
}

export async function flagAuthorizationCodeAsUsed(codeId) {
  return executeStatement('UPDATE auth_codes SET used = 1 WHERE id = ?', [codeId]);
}

export async function storeAccessToken({
  accessToken: bearerToken,
  clientId: clientIdentifier,
  userId: ownerUserId,
  scope: grantedScope,
  expiresAt: expirationTimestamp,
}) {
  return executeStatement(
    `
      INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [bearerToken, clientIdentifier, ownerUserId, grantedScope, expirationTimestamp],
  );
}

export async function loadTokenByAccessToken(bearerToken) {
  return fetchSingleRow('SELECT * FROM tokens WHERE access_token = ?', [bearerToken]);
}

export async function prepareDatabase() {
  await executeStatement(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      email     TEXT NOT NULL
    )
  `);

  await executeStatement(`
    CREATE TABLE IF NOT EXISTS clients (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id      TEXT UNIQUE NOT NULL,
      client_secret  TEXT NOT NULL,
      redirect_uris  TEXT NOT NULL
    )
  `);

  await executeStatement(`
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

  await executeStatement(`
    CREATE TABLE IF NOT EXISTS tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token  TEXT UNIQUE NOT NULL,
      client_id     TEXT NOT NULL,
      user_id       INTEGER NOT NULL,
      scope         TEXT NOT NULL,
      expires_at    INTEGER NOT NULL
    )
  `);

  await executeStatement(
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

  await executeStatement(
    `
      INSERT OR IGNORE INTO users (username, password, email)
      VALUES (?, ?, ?)
    `,
    ['testuser', 'password123', 'testuser@example.com'],
  );
}
