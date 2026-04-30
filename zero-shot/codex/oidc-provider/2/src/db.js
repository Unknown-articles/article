import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { DB_PATH } from './config.js';

sqlite3.verbose();

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new sqlite3.Database(DB_PATH);
  }
  return db;
}

export function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      db = undefined;
      resolve();
    });
  });
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

export async function initializeDatabase() {
  await run('PRAGMA foreign_keys = ON');

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL UNIQUE,
      client_secret TEXT NOT NULL,
      redirect_uris TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS signing_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kid TEXT NOT NULL UNIQUE,
      private_jwk TEXT NOT NULL,
      public_jwk TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS authorization_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      code_challenge TEXT,
      code_challenge_method TEXT,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await seedDatabase();
}

async function seedDatabase() {
  await run(
    `
      INSERT INTO clients (client_id, client_secret, redirect_uris)
      VALUES (?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        client_secret = excluded.client_secret,
        redirect_uris = excluded.redirect_uris
    `,
    [
      'test-client',
      'test-secret',
      JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback'])
    ]
  );

  await run(
    `
      INSERT INTO users (username, password, email, name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        password = excluded.password,
        email = excluded.email,
        name = excluded.name
    `,
    ['testuser', 'password123', 'testuser@example.com', 'Test User']
  );
}
