import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = join(DATA_DIR, 'db.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(DB_PATH)) writeFile(DB_PATH, '{}');

// Write mutex
let _resolve;
let writeQueue = Promise.resolve();
function withWrite(fn) {
  const previous = writeQueue;
  let release;
  writeQueue = new Promise(r => { release = r; });
  return previous.then(async () => {
    try { return await fn(); }
    finally { release(); }
  });
}

async function readDb() {
  try {
    const raw = await readFile(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch { return {}; }
}

async function writeDb(data) {
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function getCollection(collection) {
  const db = await readDb();
  return db[collection] || [];
}

export async function createItem(collection, item) {
  return withWrite(async () => {
    const db = await readDb();
    if (!db[collection]) db[collection] = [];
    const newItem = { ...item, id: uuidv4(), createdAt: new Date().toISOString() };
    db[collection].push(newItem);
    await writeDb(db);
    return newItem;
  });
}

export async function getItems(collection, query = {}) {
  const items = await getCollection(collection);
  return applyQuery(items, query);
}

export async function getItem(collection, id) {
  const items = await getCollection(collection);
  return items.find(i => i.id === id) || null;
}

export async function updateItem(collection, id, updates, patch = false) {
  return withWrite(async () => {
    const db = await readDb();
    if (!db[collection]) return null;
    const idx = db[collection].findIndex(i => i.id === id);
    if (idx === -1) return null;
    const existing = db[collection][idx];
    db[collection][idx] = patch
      ? { ...existing, ...updates, id, updatedAt: new Date().toISOString() }
      : { ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    await writeDb(db);
    return db[collection][idx];
  });
}

export async function deleteItem(collection, id) {
  return withWrite(async () => {
    const db = await readDb();
    if (!db[collection]) return false;
    const idx = db[collection].findIndex(i => i.id === id);
    if (idx === -1) return false;
    db[collection].splice(idx, 1);
    await writeDb(db);
    return true;
  });
}

export async function bulkPatchItems(collection, updatesArray) {
  return withWrite(async () => {
    const db = await readDb();
    if (!db[collection]) return [];
    
    const results = [];
    const now = new Date().toISOString();
    
    for (const updateObj of updatesArray) {
      if (!updateObj.id) continue;
      const idx = db[collection].findIndex(i => i.id === updateObj.id);
      if (idx !== -1) {
        db[collection][idx] = { ...db[collection][idx], ...updateObj, id: updateObj.id, updatedAt: now };
        results.push(db[collection][idx]);
      }
    }
    
    await writeDb(db);
    return results;
  });
}

export async function replaceCollection(collection, items) {
  return withWrite(async () => {
    const db = await readDb();
    db[collection] = items;
    await writeDb(db);
  });
}

// ─── Advanced query engine ────────────────────────────────────────────────────
function applyQuery(items, query) {
  let result = [...items];

  // Filtering (query string: field=val, field[$gt]=val, $or[0][field]=val…)
  const filters = buildFilters(query);
  if (filters) result = result.filter(item => matchFilter(item, filters));

  // Sorting: _sort=field&_order=asc|desc
  if (query._sort) {
    const order = (query._order || 'asc').toLowerCase();
    result.sort((a, b) => {
      if (a[query._sort] < b[query._sort]) return order === 'desc' ? 1 : -1;
      if (a[query._sort] > b[query._sort]) return order === 'desc' ? -1 : 1;
      return 0;
    });
  }

  // Pagination
  const offset = parseInt(query._offset) || 0;
  const limit = parseInt(query._limit);
  if (offset || limit) result = limit ? result.slice(offset, offset + limit) : result.slice(offset);

  return result;
}

function buildFilters(query) {
  const reserved = new Set(['_sort', '_order', '_limit', '_offset']);
  const conditions = [];
  for (const [key, val] of Object.entries(query)) {
    if (reserved.has(key)) continue;
    // key may be "field" or "field[$op]"
    const match = key.match(/^([^[]+)(?:\[(\$\w+)\])?$/);
    if (!match) continue;
    const [, field, op] = match;
    conditions.push({ field, op: op || '$eq', value: val });
  }
  return conditions.length ? conditions : null;
}

function matchFilter(item, conditions) {
  return conditions.every(({ field, op, value }) => {
    const v = item[field];
    switch (op) {
      case '$eq': return String(v) === String(value);
      case '$ne': return String(v) !== String(value);
      case '$gt': return Number(v) > Number(value);
      case '$lt': return Number(v) < Number(value);
      case '$gte': return Number(v) >= Number(value);
      case '$lte': return Number(v) <= Number(value);
      case '$like': return String(v).toLowerCase().includes(String(value).toLowerCase());
      case '$between': { const [lo, hi] = value.split(','); return Number(v) >= Number(lo) && Number(v) <= Number(hi); }
      default: return true;
    }
  });
}
