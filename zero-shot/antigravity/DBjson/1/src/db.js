const fs = require('fs').promises;
const path = require('path');

class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async lock() {
    return new Promise((resolve) => {
      if (this.locked) {
        this.queue.push(resolve);
      } else {
        this.locked = true;
        resolve();
      }
    });
  }

  unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}

const dbMutex = new Mutex();
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db.json');

const getDbPath = () => process.env.DB_PATH || DEFAULT_DB_PATH;

/**
 * Ensures the database file exists and is structurally valid at startup.
 */
async function ensureDbInitialized() {
  await dbMutex.lock();
  try {
    const dbPath = getDbPath();
    try {
      const raw = await fs.readFile(dbPath, 'utf8');
      JSON.parse(raw); // validate
    } catch (err) {
      if (err.code === 'ENOENT' || err instanceof SyntaxError) {
        const initData = { _users: [], _teams: [] };
        await fs.writeFile(dbPath, JSON.stringify(initData, null, 2), 'utf8');
      } else {
        throw err;
      }
    }
  } finally {
    dbMutex.unlock();
  }
}

/**
 * Reads the database without expecting to modify it.
 */
async function readDB() {
  await dbMutex.lock();
  try {
    const dbPath = getDbPath();
    try {
      const raw = await fs.readFile(dbPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { _users: [], _teams: [] };
      }
      throw err;
    }
  } finally {
    dbMutex.unlock();
  }
}

/**
 * Modifies the database. The callback is passed the current JSON data and must return the updated JSON.
 */
async function modifyDB(callback) {
  await dbMutex.lock();
  try {
    const dbPath = getDbPath();
    let data;
    try {
      const raw = await fs.readFile(dbPath, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        data = { _users: [], _teams: [] };
      } else {
        throw err;
      }
    }

    const modifiedData = await callback(data);

    // Atomic write: write to temp file then rename
    const tempPath = dbPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(modifiedData || data, null, 2), 'utf8');
    await fs.rename(tempPath, dbPath);

    return modifiedData || data;
  } finally {
    dbMutex.unlock();
  }
}

module.exports = {
  ensureDbInitialized,
  readDB,
  modifyDB,
};
