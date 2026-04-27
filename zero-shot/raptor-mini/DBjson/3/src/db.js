const fs = require('fs').promises;
const path = require('path');

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './db.json');
const initialData = { _users: [], _teams: [] };
let queue = Promise.resolve();

async function ensureDatabaseFile() {
  try {
    await fs.access(dbPath);
  } catch (err) {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

async function readRawFile() {
  await ensureDatabaseFile();
  const raw = await fs.readFile(dbPath, 'utf8');
  if (!raw.trim()) {
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(initialData));
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(initialData));
  }
}

function enqueue(task) {
  queue = queue.then(() => task());
  return queue;
}

async function readDatabase() {
  return enqueue(async () => readRawFile());
}

async function writeDatabase(db) {
  return enqueue(async () => {
    await ensureDatabaseFile();
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
  });
}

async function modifyDatabase(fn) {
  return enqueue(async () => {
    const db = await readRawFile();
    const result = await fn(db);
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
    return result;
  });
}

module.exports = {
  getDbPath: () => dbPath,
  readDatabase,
  writeDatabase,
  modifyDatabase,
  ensureDatabaseFile,
};
