const fs = require('fs').promises;
const path = require('path');

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '../db.json');
}

class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }
  async lock() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }
  unlock() {
    if (this._queue.length > 0) {
      const resolve = this._queue.shift();
      resolve();
    } else {
      this._locked = false;
    }
  }
}

const dbMutex = new Mutex();

async function getDB() {
  await dbMutex.lock();
  try {
    const data = await fs.readFile(getDbPath(), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const defaultData = { _users: [], _teams: [] };
      await fs.writeFile(getDbPath(), JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    throw err;
  } finally {
    dbMutex.unlock();
  }
}

async function updateDB(updater) {
  await dbMutex.lock();
  try {
    let data;
    try {
      const content = await fs.readFile(getDbPath(), 'utf8');
      data = JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        data = { _users: [], _teams: [] };
      } else {
        throw err;
      }
    }
    const updatedData = await updater(data);
    await fs.writeFile(getDbPath(), JSON.stringify(updatedData, null, 2), 'utf8');
    return updatedData;
  } finally {
    dbMutex.unlock();
  }
}

async function initDB() {
  await dbMutex.lock();
  try {
    try {
      await fs.access(getDbPath());
    } catch (e) {
      const defaultData = { _users: [], _teams: [] };
      await fs.writeFile(getDbPath(), JSON.stringify(defaultData, null, 2), 'utf8');
    }
  } finally {
    dbMutex.unlock();
  }
}

module.exports = { getDB, updateDB, initDB };
