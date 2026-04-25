import sqlite3 from 'sqlite3';
import { mkdirSync } from 'fs';
import { promisify } from 'util';
import { DATA_DIR, CLIENTS, USERS } from '../config.js';
import { hashPassword } from '../utils.js';

let db;

export async function initDatabase() {
  mkdirSync(DATA_DIR, { recursive: true });
  db = new sqlite3.Database(`${DATA_DIR}/oidc.sqlite`);
  db.runAsync = promisify(db.run.bind(db));
  db.getAsync = promisify(db.get.bind(db));
  db.execAsync = promisify(db.exec.bind(db));

  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE NOT NULL,
      client_secret TEXT NOT NULL,
      redirect_uris TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorization_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      code_challenge TEXT,
      code_challenge_method TEXT,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  await seedClients();
  await seedUsers();
}

async function seedClients() {
  for (const client of CLIENTS) {
    const existing = await db.getAsync('SELECT id FROM clients WHERE client_id = ?', client.client_id);
    if (!existing) {
      await db.runAsync(
        'INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)',
        client.client_id,
        client.client_secret,
        JSON.stringify(client.redirect_uris)
      );
    }
  }
}

async function seedUsers() {
  for (const user of USERS) {
    const existing = await db.getAsync('SELECT id FROM users WHERE username = ?', user.username);
    if (!existing) {
      await db.runAsync(
        'INSERT INTO users (username, password_hash, email, name) VALUES (?, ?, ?, ?)',
        user.username,
        hashPassword(user.password),
        user.email,
        user.name
      );
    }
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
