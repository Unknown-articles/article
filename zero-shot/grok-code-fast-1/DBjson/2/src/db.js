const fs = require('fs-extra');
const lockfile = require('proper-lockfile');

const dbPath = process.env.DB_PATH || 'db.json';

async function readDB() {
  await lockfile.lock(dbPath);
  try {
    return await fs.readJson(dbPath);
  } finally {
    await lockfile.unlock(dbPath);
  }
}

async function updateDB(updater) {
  await lockfile.lock(dbPath);
  try {
    let data = await fs.readJson(dbPath);
    const result = updater(data);
    await fs.writeJson(dbPath, data, { spaces: 2 });
    return result;
  } finally {
    await lockfile.unlock(dbPath);
  }
}

async function initDB() {
  if (!await fs.pathExists(dbPath)) {
    await fs.writeJson(dbPath, { "_users": [], "_teams": [] }, { spaces: 2 });
  }
}

module.exports = { readDB, updateDB, initDB };