import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('./database.sqlite');

export const run = promisify(db.run.bind(db));
export const get = promisify(db.get.bind(db));
export const all = promisify(db.all.bind(db));

export async function initDb() {
  await run(`DROP TABLE IF EXISTS users`);
  await run(`DROP TABLE IF EXISTS clients`);
  await run(`DROP TABLE IF EXISTS authorization_codes`);
  await run(`DROP TABLE IF EXISTS tokens`);

  await run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT
    )
  `);

  await run(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE,
      client_secret TEXT,
      redirect_uris TEXT
    )
  `);

  await run(`
    CREATE TABLE authorization_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      client_id TEXT,
      redirect_uri TEXT,
      user_id INTEGER,
      scope TEXT,
      code_challenge TEXT,
      code_challenge_method TEXT,
      used BOOLEAN DEFAULT 0,
      expires_at INTEGER
    )
  `);

  await run(`
    CREATE TABLE tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT UNIQUE,
      client_id TEXT,
      user_id INTEGER,
      scope TEXT,
      expires_at INTEGER
    )
  `);

  // Seed Data
  await run(
    `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
    ['testuser', 'password123', 'testuser@example.com']
  );

  await run(
    `INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)`,
    ['test-client', 'test-secret', JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback'])]
  );
  
  console.log('Database initialized and seeded.');
}
