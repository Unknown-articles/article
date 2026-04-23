import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

export function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create tables
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          username  TEXT UNIQUE NOT NULL,
          password  TEXT NOT NULL,
          email     TEXT NOT NULL
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS clients (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id      TEXT UNIQUE NOT NULL,
          client_secret  TEXT NOT NULL,
          redirect_uris  TEXT NOT NULL
        )
      `);

      db.run(`
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

      db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          access_token  TEXT UNIQUE NOT NULL,
          client_id     TEXT NOT NULL,
          user_id       INTEGER NOT NULL,
          scope         TEXT NOT NULL,
          expires_at    INTEGER NOT NULL
        )
      `);

      // Seed database
      db.get(`SELECT id FROM clients WHERE client_id = ?`, ['test-client'], (err, row) => {
        if (!row) {
          db.run(
            `INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)`,
            ['test-client', 'test-secret', JSON.stringify(["http://localhost:8080/callback", "http://localhost:3001/callback"])]
          );
        }
      });

      db.get(`SELECT id FROM users WHERE username = ?`, ['testuser'], (err, row) => {
        if (!row) {
          db.run(
            `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
            ['testuser', 'password123', 'testuser@example.com']
          );
        }
      });

      resolve();
    });
  });
}

export default db;
