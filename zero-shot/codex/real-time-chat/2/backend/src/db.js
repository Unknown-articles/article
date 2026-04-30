import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

export const DB_PATH = process.env.DB_PATH || './chat.db';

let database;
let sqlReady;

function ensureDirectory() {
  const dbDir = path.dirname(DB_PATH);
  if (dbDir && dbDir !== '.') {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function persistDb() {
  ensureDirectory();
  fs.writeFileSync(DB_PATH, Buffer.from(database.export()));
}

function getSingleRow(sql, params = []) {
  const statement = database.prepare(sql);
  try {
    statement.bind(params);
    return statement.step() ? statement.getAsObject() : undefined;
  } finally {
    statement.free();
  }
}

function getRows(sql, params = []) {
  const statement = database.prepare(sql);
  const rows = [];

  try {
    statement.bind(params);
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
  } finally {
    statement.free();
  }

  return rows;
}

export async function initDb() {
  if (database) {
    return database;
  }

  if (!sqlReady) {
    sqlReady = initSqlJs();
  }

  const SQL = await sqlReady;
  ensureDirectory();

  const existingFile = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  database = existingFile ? new SQL.Database(existingFile) : new SQL.Database();
  database.run('PRAGMA foreign_keys = ON');
  initializeDatabase();
  persistDb();

  return database;
}

export function getDb() {
  if (!database) {
    throw new Error('Database has not been initialized');
  }

  return database;
}

export function initializeDatabase() {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

export function findUserById(userId) {
  return getSingleRow('SELECT id, username FROM users WHERE id = ?', [userId]);
}

export function findUserByUsername(username) {
  return getSingleRow('SELECT id, username, password FROM users WHERE username = ?', [username]);
}

export function createUser(username, passwordHash) {
  database.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, passwordHash]);
  const user = getSingleRow('SELECT id, username FROM users WHERE id = last_insert_rowid()');
  persistDb();
  return user;
}

export function getMessageHistory() {
  return getRows(`
    SELECT
      id,
      user_id AS userId,
      username,
      content,
      timestamp
    FROM messages
    ORDER BY id ASC
    LIMIT 100
  `);
}

export function createMessage(user, content) {
  const timestamp = new Date().toISOString();
  database.run(`
    INSERT INTO messages (user_id, username, content, timestamp)
    VALUES (?, ?, ?, ?)
  `, [user.id, user.username, content, timestamp]);

  const row = getSingleRow(`
    SELECT
      id,
      user_id AS userId,
      username,
      content,
      timestamp
    FROM messages
    WHERE id = last_insert_rowid()
  `);
  persistDb();
  return row;
}

export function closeDb() {
  if (database) {
    database.close();
    database = undefined;
  }
}
