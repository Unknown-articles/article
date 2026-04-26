const fs = require('fs').promises;
const config = require('../config');

/**
 * Simple async mutex: serialises all DB reads and writes so concurrent
 * requests never interleave their file I/O.
 */
class AsyncMutex {
  constructor() {
    this._tail = Promise.resolve();
  }

  runExclusive(fn) {
    let release;
    const ticket = new Promise(resolve => { release = resolve; });
    const prev = this._tail;
    this._tail = prev.then(() => ticket);
    return prev.then(() => {
      try {
        return Promise.resolve(fn()).finally(release);
      } catch (err) {
        release();
        return Promise.reject(err);
      }
    });
  }
}

const mutex = new AsyncMutex();

const EMPTY_DB = () => ({ _users: [], _teams: [] });

async function readRaw() {
  try {
    const content = await fs.readFile(config.dbPath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed._users) parsed._users = [];
    if (!parsed._teams) parsed._teams = [];
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return EMPTY_DB();
    throw err;
  }
}

async function writeRaw(db) {
  await fs.writeFile(config.dbPath, JSON.stringify(db, null, 2), 'utf8');
}

/**
 * Run a read-write transaction. `fn` receives the current DB object,
 * mutates it in place, and returns a result value.  The DB is flushed
 * to disk before the promise resolves.
 */
function transaction(fn) {
  return mutex.runExclusive(async () => {
    const db = await readRaw();
    const result = await fn(db);
    await writeRaw(db);
    return result;
  });
}

/**
 * Read-only access — still serialised so reads see a consistent snapshot.
 */
function readDb(fn) {
  return mutex.runExclusive(async () => {
    const db = await readRaw();
    return fn(db);
  });
}

module.exports = { transaction, readDb };
