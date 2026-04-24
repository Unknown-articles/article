import sqlite3 from 'sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = `${__dirname}/data`;
mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(`${dbDir}/database.sqlite`);

const executeSql = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const fetchRow = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});

export async function prepareDatabase() {
  await executeSql(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL
  )`);

  await executeSql(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT NOT NULL
  )`);

  await executeSql(`CREATE TABLE IF NOT EXISTS auth_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL,
    code_challenge TEXT,
    code_challenge_method TEXT,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0
  )`);

  await executeSql(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);

  const existingClient = await fetchRow(`SELECT id FROM clients WHERE client_id = ?`, [
    'test-client',
  ]);

  if (!existingClient) {
    await executeSql(
      `INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)`,
      [
        'test-client',
        'test-secret',
        JSON.stringify([
          'http://localhost:8080/callback',
          'http://localhost:3001/callback',
        ]),
      ]
    );
  }

  const existingUser = await fetchRow(`SELECT id FROM users WHERE username = ?`, [
    'testuser',
  ]);

  if (!existingUser) {
    await runAsync(
      `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
      ['testuser', 'password123', 'testuser@example.com']
    );
  }
}

export async function findClientByIdentifier(clientId) {
  return fetchRow(`SELECT * FROM clients WHERE client_id = ?`, [clientId]);
}

export async function findUserByName(username) {
  return fetchRow(`SELECT * FROM users WHERE username = ?`, [username]);
}

export async function findUserByRecordId(userId) {
  return fetchRow(`SELECT * FROM users WHERE id = ?`, [userId]);
}

export async function storeAuthorizationCode({
  code,
  clientId,
  userId,
  redirectUri,
  scope,
  codeChallenge,
  codeChallengeMethod,
  expiresAt,
}) {
  await executeSql(
    `INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    ]
  );
}

export async function fetchAuthorizationCode(code) {
  return fetchRow(`SELECT * FROM auth_codes WHERE code = ?`, [code]);
}

export async function markAuthorizationCodeUsed(code) {
  await executeSql(`UPDATE auth_codes SET used = 1 WHERE code = ?`, [code]);
}

export async function storeAccessToken({
  accessToken,
  clientId,
  userId,
  scope,
  expiresAt,
}) {
  await executeSql(
    `INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [accessToken, clientId, userId, scope, expiresAt]
  );
}

export async function fetchTokenByAccessToken(accessToken) {
  return fetchRow(`SELECT * FROM tokens WHERE access_token = ?`, [accessToken]);
}

export default db;
