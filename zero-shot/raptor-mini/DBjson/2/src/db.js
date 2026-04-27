const fs = require('fs/promises');
const path = require('path');
const config = require('./config');

let queue = Promise.resolve();

async function ensureDbFile() {
  const dbDir = path.dirname(config.dbPath);
  await fs.mkdir(dbDir, { recursive: true });
  try {
    await fs.access(config.dbPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeFile({ _users: [], _teams: [] });
    } else {
      throw err;
    }
  }
}

async function readFile() {
  const content = await fs.readFile(config.dbPath, 'utf8');
  return content.trim() ? JSON.parse(content) : { _users: [], _teams: [] };
}

async function writeFile(data) {
  await fs.writeFile(config.dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function enqueue(operation) {
  queue = queue.then(operation, operation);
  return queue;
}

async function init() {
  return enqueue(async () => {
    await ensureDbFile();
    const db = await readFile();
    if (!Array.isArray(db._users)) db._users = [];
    if (!Array.isArray(db._teams)) db._teams = [];
    await writeFile(db);
    return db;
  });
}

async function readDatabase() {
  return enqueue(async () => {
    await ensureDbFile();
    const db = await readFile();
    if (!Array.isArray(db._users)) db._users = [];
    if (!Array.isArray(db._teams)) db._teams = [];
    return db;
  });
}

async function writeDatabase(updater) {
  return enqueue(async () => {
    await ensureDbFile();
    const db = await readFile();
    const result = await updater(db);
    await writeFile(db);
    return result;
  });
}

async function getCollection(name) {
  const db = await readDatabase();
  if (!Object.prototype.hasOwnProperty.call(db, name)) {
    return [];
  }
  return db[name];
}

async function ensureCollection(name) {
  return writeDatabase(async (db) => {
    if (!Object.prototype.hasOwnProperty.call(db, name)) {
      db[name] = [];
    }
    return db[name];
  });
}

async function createItem(collection, item) {
  return writeDatabase(async (db) => {
    if (!Object.prototype.hasOwnProperty.call(db, collection)) {
      db[collection] = [];
    }
    db[collection].push(item);
    return item;
  });
}

async function updateCollectionItem(collection, id, updater) {
  return writeDatabase(async (db) => {
    const list = db[collection] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const updated = await updater(list[index]);
    if (updated) {
      list[index] = updated;
      db[collection] = list;
    }
    return updated;
  });
}

async function deleteCollectionItem(collection, id) {
  return writeDatabase(async (db) => {
    const list = db[collection] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    db[collection] = list;
    return true;
  });
}

async function collectionExists(name) {
  const db = await readDatabase();
  return Object.prototype.hasOwnProperty.call(db, name);
}

module.exports = {
  init,
  readDatabase,
  writeDatabase,
  getCollection,
  ensureCollection,
  createItem,
  updateCollectionItem,
  deleteCollectionItem,
  collectionExists
};
