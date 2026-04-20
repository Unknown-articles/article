'use strict';
const fs = require('fs');
const path = require('path');

class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  release() {
    const next = this._queue.shift();
    if (next) {
      next();
    } else {
      this._locked = false;
    }
  }

  async run(fn) {
    await this.acquire();
    try {
      return fn();
    } finally {
      this.release();
    }
  }
}

const mutex = new Mutex();

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '../db.json');
}

function readDb() {
  try {
    const raw = fs.readFileSync(getDbPath(), 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data._users)) data._users = [];
    if (!Array.isArray(data._teams)) data._teams = [];
    return data;
  } catch {
    return { _users: [], _teams: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2), 'utf8');
}

// Runs fn(db) inside mutex; fn must be synchronous and may mutate db.
// db is written back after fn returns.
async function transaction(fn) {
  return mutex.run(() => {
    const db = readDb();
    const result = fn(db);
    writeDb(db);
    return result;
  });
}

// Runs fn(db) inside mutex without writing back (read-only access).
async function readOnly(fn) {
  return mutex.run(() => {
    const db = readDb();
    return fn(db);
  });
}

module.exports = { transaction, readOnly };
