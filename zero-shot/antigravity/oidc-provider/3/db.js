import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'oidc.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database', err);
  } else {
    console.log('Connected to SQLite database');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        client_id TEXT PRIMARY KEY,
        client_secret TEXT NOT NULL,
        redirect_uris TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope TEXT NOT NULL,
        code_challenge TEXT,
        code_challenge_method TEXT,
        used BOOLEAN DEFAULT 0,
        expires_at INTEGER NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        access_token TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        scope TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Seed User
    db.run(
      \`INSERT OR IGNORE INTO users (id, username, password, email) VALUES (1, 'testuser', 'password123', 'testuser@example.com')\`
    );

    // Seed Client
    db.run(
      \`INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris) VALUES ('test-client', 'test-secret', '["http://localhost:8080/callback", "http://localhost:3001/callback"]')\`
    );
  });
}

// Promisified DB helpers
export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};
