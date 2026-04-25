import sqlite3 from 'sqlite3';

const db = new sqlite3.Database(':memory:');

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const initDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS clients (
      client_id TEXT PRIMARY KEY,
      client_secret TEXT,
      redirect_uris TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT,
      redirect_uri TEXT,
      sub TEXT,
      scope TEXT,
      code_challenge TEXT,
      code_challenge_method TEXT,
      expires_at INTEGER,
      used INTEGER DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tokens (
      access_token TEXT PRIMARY KEY,
      client_id TEXT,
      sub TEXT,
      scope TEXT,
      expires_at INTEGER
    )
  `);

  // Seed Data
  await run(`INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris) VALUES (?, ?, ?)`,
    ['test-client', 'test-secret', JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback'])]
  );

  await run(`INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)`,
    ['testuser', 'password123', 'testuser@example.com']
  );
};

export default db;
