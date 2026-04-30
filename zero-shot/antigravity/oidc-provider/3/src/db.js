import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory or file-based DB. We'll use file-based so it persists during dev, but in-memory for tests might be better. 
// Requirements say "database (SQLite)" - "store: users, clients, authorization codes, tokens".
// Let's use a file named "oidc.db"
const dbPath = path.join(__dirname, '../oidc.db');
const db = new sqlite3.Database(dbPath);

export const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS clients (
          client_id TEXT PRIMARY KEY,
          client_secret TEXT,
          redirect_uris TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          email TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS authorization_codes (
          code TEXT PRIMARY KEY,
          client_id TEXT,
          redirect_uri TEXT,
          user_id INTEGER,
          scope TEXT,
          code_challenge TEXT,
          code_challenge_method TEXT,
          expires_at INTEGER,
          used INTEGER DEFAULT 0
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
          access_token TEXT PRIMARY KEY,
          client_id TEXT,
          user_id INTEGER,
          scope TEXT,
          expires_at INTEGER
        )
      `);

      // Seed data
      const client_id = "test-client";
      const client_secret = "test-secret";
      const redirect_uris = JSON.stringify(["http://localhost:8080/callback", "http://localhost:3001/callback"]);
      
      db.run(`INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)`, [client_id, client_secret, redirect_uris]);

      const username = "testuser";
      const password = "password123";
      const email = "testuser@example.com";
      
      db.run(`INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)`, [username, password, email], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const getDb = () => db;

// Helper functions for DB queries
export const getClient = (clientId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM clients WHERE client_id = ?', [clientId], (err, row) => {
      if (err) reject(err);
      else {
        if (row) {
            row.redirect_uris = JSON.parse(row.redirect_uris);
        }
        resolve(row);
      }
    });
  });
};

export const getUser = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const saveAuthCode = (code, clientId, redirectUri, userId, scope, codeChallenge, codeChallengeMethod, expiresAt) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO authorization_codes (code, client_id, redirect_uri, user_id, scope, code_challenge, code_challenge_method, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, clientId, redirectUri, userId, scope, codeChallenge, codeChallengeMethod, expiresAt],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

export const getAuthCode = (code) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM authorization_codes WHERE code = ?', [code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const markAuthCodeAsUsed = (code) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE authorization_codes SET used = 1 WHERE code = ?', [code], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const saveToken = (accessToken, clientId, userId, scope, expiresAt) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO tokens (access_token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)',
      [accessToken, clientId, userId, scope, expiresAt],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const getToken = (accessToken) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tokens WHERE access_token = ?', [accessToken], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};
