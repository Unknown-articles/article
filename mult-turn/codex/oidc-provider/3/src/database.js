import sqlite3 from 'sqlite3';

const verboseSqlite = sqlite3.verbose();

export const activeDatabase = new verboseSqlite.Database(process.env.DB_PATH ?? 'oidc.sqlite');

function perform(sqlStatement, bindings = []) {
  return new Promise((resolve, reject) => {
    activeDatabase.run(sqlStatement, bindings, function onPerform(statementError) {
      if (statementError) {
        reject(statementError);
        return;
      }

      resolve(this);
    });
  });
}

function lookupOne(sqlStatement, bindings = []) {
  return new Promise((resolve, reject) => {
    activeDatabase.get(sqlStatement, bindings, (statementError, resultRow) => {
      if (statementError) {
        reject(statementError);
        return;
      }

      resolve(resultRow);
    });
  });
}

export async function fetchClientRecord(clientCode) {
  return lookupOne('SELECT * FROM clients WHERE client_id = ?', [clientCode]);
}

export async function fetchUserRecordByUsername(loginName) {
  return lookupOne('SELECT * FROM users WHERE username = ?', [loginName]);
}

export async function fetchUserRecordById(userPrimaryKey) {
  return lookupOne('SELECT * FROM users WHERE id = ?', [userPrimaryKey]);
}

export async function insertAuthorizationCode({
  code: codeValue,
  clientId: clientCode,
  userId: subjectUserId,
  redirectUri: registeredRedirectUri,
  scope: scopeValue,
  codeChallenge: challengeValue = null,
  codeChallengeMethod: challengeMethodValue = null,
  expiresAt: expiryEpochSeconds,
}) {
  return perform(
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
      codeValue,
      clientCode,
      subjectUserId,
      registeredRedirectUri,
      scopeValue,
      challengeValue,
      challengeMethodValue,
      expiryEpochSeconds,
    ],
  );
}

export async function fetchAuthorizationCode(codeValue) {
  return lookupOne('SELECT * FROM auth_codes WHERE code = ?', [codeValue]);
}

export async function consumeAuthorizationCode(codePrimaryKey) {
  return perform('UPDATE auth_codes SET used = 1 WHERE id = ?', [codePrimaryKey]);
}

export async function insertAccessToken({
  accessToken: tokenValue,
  clientId: clientCode,
  userId: subjectUserId,
  scope: scopeValue,
  expiresAt: expiryEpochSeconds,
}) {
  return perform(
    `
      INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [tokenValue, clientCode, subjectUserId, scopeValue, expiryEpochSeconds],
  );
}

export async function fetchTokenRecord(tokenValue) {
  return lookupOne('SELECT * FROM tokens WHERE access_token = ?', [tokenValue]);
}

export async function bootDatabase() {
  await perform(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      email     TEXT NOT NULL
    )
  `);

  await perform(`
    CREATE TABLE IF NOT EXISTS clients (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id      TEXT UNIQUE NOT NULL,
      client_secret  TEXT NOT NULL,
      redirect_uris  TEXT NOT NULL
    )
  `);

  await perform(`
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

  await perform(`
    CREATE TABLE IF NOT EXISTS tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token  TEXT UNIQUE NOT NULL,
      client_id     TEXT NOT NULL,
      user_id       INTEGER NOT NULL,
      scope         TEXT NOT NULL,
      expires_at    INTEGER NOT NULL
    )
  `);

  await perform(
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

  await perform(
    `
      INSERT OR IGNORE INTO users (username, password, email)
      VALUES (?, ?, ?)
    `,
    ['testuser', 'password123', 'testuser@example.com'],
  );
}
