import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseFile = path.join(__dirname, '../data/oidc.sqlite');

let db;

function createAsyncDatabase() {
  const sqlite = sqlite3.verbose();
  const rawDb = new sqlite.Database(databaseFile);
  return {
    run(sql, ...params) {
      return new Promise((resolve, reject) => {
        rawDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve(this);
        });
      });
    },
    get(sql, ...params) {
      return new Promise((resolve, reject) => {
        rawDb.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    },
    all(sql, ...params) {
      return new Promise((resolve, reject) => {
        rawDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        rawDb.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };
}

async function openDatabase() {
  if (!db) {
    db = createAsyncDatabase();
  }
  return db;
}

export async function getDb() {
  return openDatabase();
}

export async function initializeDatabase() {
  const database = await openDatabase();

  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE NOT NULL,
      client_secret TEXT NOT NULL,
      redirect_uris TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      user_sub TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      code_challenge TEXT,
      code_challenge_method TEXT,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      access_token TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_sub TEXT NOT NULL,
      scope TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      id_token TEXT NOT NULL
    );
  `);

  const clientCount = await database.get('SELECT COUNT(1) as count FROM clients');
  if (!clientCount || clientCount.count === 0) {
    await database.run(
      'INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)',
      'test-client',
      'test-secret',
      JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback'])
    );
  }

  const userCount = await database.get('SELECT COUNT(1) as count FROM users');
  if (!userCount || userCount.count === 0) {
    await database.run(
      'INSERT INTO users (sub, username, password, email) VALUES (?, ?, ?, ?)',
      'testuser-sub',
      'testuser',
      'password123',
      'testuser@example.com'
    );
  }
}

export async function findClient(clientId) {
  const database = await getDb();
  return database.get('SELECT * FROM clients WHERE client_id = ?', clientId);
}

export async function findUserByUsername(username) {
  const database = await getDb();
  return database.get('SELECT * FROM users WHERE username = ?', username);
}

export async function findUserBySub(sub) {
  const database = await getDb();
  return database.get('SELECT * FROM users WHERE sub = ?', sub);
}

export async function saveAuthCode(codeData) {
  const database = await getDb();
  await database.run(
    `INSERT INTO auth_codes (code, client_id, redirect_uri, user_sub, scope, expires_at, code_challenge, code_challenge_method, used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    codeData.code,
    codeData.client_id,
    codeData.redirect_uri,
    codeData.user_sub,
    codeData.scope,
    codeData.expires_at,
    codeData.code_challenge,
    codeData.code_challenge_method,
    codeData.created_at
  );
}

export async function getAuthCode(code) {
  const database = await getDb();
  return database.get('SELECT * FROM auth_codes WHERE code = ?', code);
}

export async function markAuthCodeUsed(code) {
  const database = await getDb();
  await database.run('UPDATE auth_codes SET used = 1 WHERE code = ?', code);
}

export async function saveToken(tokenData) {
  const database = await getDb();
  await database.run(
    `INSERT INTO tokens (access_token, client_id, user_sub, scope, issued_at, expires_at, id_token)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    tokenData.access_token,
    tokenData.client_id,
    tokenData.user_sub,
    tokenData.scope,
    tokenData.issued_at,
    tokenData.expires_at,
    tokenData.id_token
  );
}

export async function findToken(accessToken) {
  const database = await getDb();
  return database.get('SELECT * FROM tokens WHERE access_token = ?', accessToken);
}
