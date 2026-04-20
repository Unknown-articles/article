import { readFile, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { DATA_PATH } from '../config.js';

// ─── File I/O + write queue (concurrency control) ────────────────────────────

let writeQueue = Promise.resolve();

async function readDb() {
  try {
    const content = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Serialises all mutations through a queue so concurrent requests
 * never interleave their read-modify-write cycles.
 *
 * fn receives the current DB object, mutates it in-place, and returns
 * a value that is forwarded to the caller.  The updated DB is flushed
 * to disk after fn resolves.  Errors in fn reject the returned promise
 * but do NOT break the queue for subsequent callers.
 */
function withDb(fn) {
  const op = new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const data = await readDb();
        const result = await fn(data);
        await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
  return op;
}

// ─── Access helpers ────────────────────────────────────────────────────────────

function canRead(item, userId, role) {
  if (role === 'admin') return true;
  if (item.ownerId === userId) return true;
  const shared = item.sharedWith || [];
  return shared.some(s => (typeof s === 'string' ? s : s.userId) === userId);
}

function canWrite(item, userId, role) {
  if (role === 'admin') return true;
  if (item.ownerId === userId) return true;
  const shared = item.sharedWith || [];
  return shared.some(s => typeof s === 'object' && s.userId === userId && s.canWrite === true);
}

// ─── Query helpers ─────────────────────────────────────────────────────────────

function matchesCondition(item, field, op, value) {
  const v = item[field];
  switch (op) {
    case 'eq':      return String(v) === String(value);
    case 'ne':      return String(v) !== String(value);
    case 'gt':      return Number(v) >  Number(value);
    case 'lt':      return Number(v) <  Number(value);
    case 'gte':     return Number(v) >= Number(value);
    case 'lte':     return Number(v) <= Number(value);
    case 'between': {
      const [lo, hi] = String(value).split(',').map(Number);
      return Number(v) >= lo && Number(v) <= hi;
    }
    case 'like':    return String(v).toLowerCase().includes(String(value).toLowerCase());
    default:        return true;
  }
}

function applyFilters(items, filterObj, logic) {
  if (!filterObj || !Object.keys(filterObj).length) return items;

  const conditions = [];
  for (const [field, ops] of Object.entries(filterObj)) {
    for (const [op, value] of Object.entries(ops)) {
      conditions.push({ field, op, value });
    }
  }

  return items.filter(item => {
    const results = conditions.map(({ field, op, value }) =>
      matchesCondition(item, field, op, value)
    );
    return (logic || 'and') === 'or'
      ? results.some(Boolean)
      : results.every(Boolean);
  });
}

function applySort(items, sortParam) {
  if (!sortParam) return items;
  const [field, dir = 'asc'] = String(sortParam).split(':');
  return [...items].sort((a, b) => {
    if (a[field] < b[field]) return dir === 'asc' ? -1 : 1;
    if (a[field] > b[field]) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}

function applyPagination(items, limit, offset) {
  const start = parseInt(offset) || 0;
  const lim   = limit != null ? parseInt(limit) : null;
  const page  = lim != null ? items.slice(start, start + lim) : items.slice(start);
  return { data: page, total: items.length, limit: lim, offset: start };
}

// ─── Public CRUD ───────────────────────────────────────────────────────────────

export async function getAll(collection, query, userId, role) {
  const data = await readDb();
  let items = data[collection] || [];

  if (role !== 'admin') {
    items = items.filter(item => canRead(item, userId, role));
  }

  // filter[field][op]=value  (Express parses bracket notation automatically)
  if (query.filter) items = applyFilters(items, query.filter, query.logic);
  if (query.sort)   items = applySort(items, query.sort);

  return applyPagination(items, query.limit, query.offset);
}

export async function getById(collection, id, userId, role) {
  const data = await readDb();
  const item = (data[collection] || []).find(i => i.id === id);
  if (!item) return null;
  if (!canRead(item, userId, role)) return { forbidden: true };
  return item;
}

export function create(collection, body, userId) {
  return withDb(data => {
    if (!data[collection]) data[collection] = [];
    const item = {
      id: uuidv4(),
      ...body,
      ownerId: userId || 'anonymous',
      sharedWith: body.sharedWith || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data[collection].push(item);
    return item;
  });
}

export function update(collection, id, body, userId, role, partial = false) {
  return withDb(data => {
    if (!data[collection]) return null;
    const idx = data[collection].findIndex(i => i.id === id);
    if (idx === -1) return null;
    const item = data[collection][idx];
    if (!canWrite(item, userId, role)) return { forbidden: true };

    const updated = partial
      ? { ...item, ...body, id: item.id, ownerId: item.ownerId, updatedAt: new Date().toISOString() }
      : { id: item.id, ownerId: item.ownerId, sharedWith: item.sharedWith, ...body, updatedAt: new Date().toISOString() };

    data[collection][idx] = updated;
    return updated;
  });
}

export function remove(collection, id, userId, role) {
  return withDb(data => {
    if (!data[collection]) return null;
    const idx = data[collection].findIndex(i => i.id === id);
    if (idx === -1) return null;
    if (!canWrite(data[collection][idx], userId, role)) return { forbidden: true };
    data[collection].splice(idx, 1);
    return { deleted: true };
  });
}
