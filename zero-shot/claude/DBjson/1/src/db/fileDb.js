'use strict';

/**
 * File-based JSON database with:
 *  - In-memory cache to reduce disk reads
 *  - Async mutex to serialise all reads and writes, preventing race conditions
 *  - Atomic transaction: read + mutate + write happen inside a single mutex
 *    acquisition so no interleaved request can corrupt the data mid-operation
 */

const fs   = require('fs');
const path = require('path');
const config = require('../config');

// ---------------------------------------------------------------------------
// Async Mutex
// ---------------------------------------------------------------------------

class AsyncMutex {
  constructor() {
    this._queue  = [];
    this._locked = false;
  }

  /** Returns a Promise that resolves once the lock is acquired. */
  _acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  _release() {
    if (this._queue.length > 0) {
      this._queue.shift()();
    } else {
      this._locked = false;
    }
  }

  /** Run fn exclusively; releases the lock even if fn throws. */
  async run(fn) {
    await this._acquire();
    try {
      return await fn();
    } finally {
      this._release();
    }
  }
}

const mutex = new AsyncMutex();

// ---------------------------------------------------------------------------
// Disk helpers
// ---------------------------------------------------------------------------

let cache = null;

function ensureFile() {
  const dir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.DB_PATH)) {
    fs.writeFileSync(config.DB_PATH, JSON.stringify({ _users: [], _teams: [] }, null, 2), 'utf8');
  }
}

function loadFromDisk() {
  ensureFile();
  return JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
}

function saveToDisk(data) {
  fs.writeFileSync(config.DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a deep clone of the current database state.
 * Acquired under the mutex to ensure a consistent snapshot.
 */
async function read() {
  return mutex.run(() => {
    if (!cache) cache = loadFromDisk();
    return JSON.parse(JSON.stringify(cache));
  });
}

/**
 * Atomic read-mutate-write transaction.
 *
 * `fn` receives the *live* cache object and may mutate it freely.
 * If `fn` throws (e.g. an ApiError), the cache is rolled back and
 * nothing is written to disk.
 *
 * @param {(data: object) => any} fn  Synchronous mutator; return value is forwarded.
 * @returns {Promise<any>}            Whatever `fn` returns.
 */
async function transaction(fn) {
  return mutex.run(() => {
    if (!cache) cache = loadFromDisk();
    const snapshot = JSON.stringify(cache);
    try {
      const result = fn(cache);
      saveToDisk(cache);
      return result;
    } catch (err) {
      cache = JSON.parse(snapshot); // rollback in-memory state
      throw err;
    }
  });
}

module.exports = { read, transaction };

// Sharing note: sharedWith / sharedWithTeams fields on items drive canRead/canWrite.
// Team membership is resolved at query time from data._teams.
