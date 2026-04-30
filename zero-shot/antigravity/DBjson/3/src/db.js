const fs = require('fs/promises');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../db.json');

let queue = Promise.resolve();

const DEFAULT_DB = { _users: [], _teams: [] };

async function initDb() {
  try {
    await fs.access(DB_PATH);
    const data = await fs.readFile(DB_PATH, 'utf8');
    if (!data.trim()) {
       await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    } else {
        JSON.parse(data);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    } else {
      throw err;
    }
  }
}

async function readDb() {
  return new Promise((resolve, reject) => {
    queue = queue.then(async () => {
      try {
        const data = await fs.readFile(DB_PATH, 'utf8');
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function writeDb(data) {
  return new Promise((resolve, reject) => {
    queue = queue.then(async () => {
      try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { initDb, readDb, writeDb };
