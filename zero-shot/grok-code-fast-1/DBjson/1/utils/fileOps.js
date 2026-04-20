const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');

const DB_PATH = path.join(__dirname, 'db.json');

async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

async function writeDB(data) {
  const release = await lockfile.lock(DB_PATH);
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
  } finally {
    await release();
  }
}

module.exports = { readDB, writeDB };