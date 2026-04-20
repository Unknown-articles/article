'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SALT_ROUNDS = 10;

const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;

const DEFAULT_DB = { _users: [], _teams: [] };

// ── DB helpers ────────────────────────────────────────────────────────────────

function loadDb() {
  if (!DB_PATH) {
    console.warn('DB_PATH not set; using in-memory default.');
    return structuredClone(DEFAULT_DB);
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return structuredClone(DEFAULT_DB);
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8').trim();
  if (!raw) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return structuredClone(DEFAULT_DB);
  }
  return JSON.parse(raw);
}

async function persistDb(db) {
  if (!DB_PATH) return;
  const tmp = DB_PATH + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.promises.rename(tmp, DB_PATH);
}

// ── In-memory store ───────────────────────────────────────────────────────────

const db = loadDb();

function dbKey(resource) { return `_${resource}`; }

function getCollection(resource) {
  const key = dbKey(resource);
  if (!Array.isArray(db[key])) db[key] = [];
  return db[key];
}

// ── Write lock (serialises all mutations) ─────────────────────────────────────

let writeChain = Promise.resolve();

// Enqueues fn so concurrent writes execute one at a time.
// fn must be async; failures do not break the chain.
function withWriteLock(fn) {
  const next = writeChain.then(fn);
  writeChain = next.then(() => {}, () => {});
  return next;
}

function lockErr(res) {
  return () => { if (!res.headersSent) res.status(500).json({ error: 'Server error' }); };
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

const RESERVED_COLLECTIONS = new Set(['users', 'teams', '_users', '_teams']);

function blockReserved(req, res, next) {
  if (RESERVED_COLLECTIONS.has(req.params.resource)) {
    return res.status(403).json({ error: 'Reserved collection' });
  }
  next();
}

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  // Hash before acquiring the lock — bcrypt is slow and needs no shared state.
  let hash;
  try { hash = await bcrypt.hash(password, SALT_ROUNDS); }
  catch { return res.status(500).json({ error: 'Server error' }); }

  withWriteLock(async () => {
    const users = getCollection('users');
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const role = users.length === 0 ? 'admin' : 'user';
    const user = { id: randomUUID(), username, passwordHash: hash, role };
    users.push(user);
    await persistDb(db);
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  }).catch(lockErr(res));
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const users = getCollection('users');
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const { id, username, role } = req.user;
  res.json({ id, username, role });
});

app.get('/auth/users', requireAuth, requireAdmin, (_req, res) => {
  const users = getCollection('users').map(({ id, username, role }) => ({ id, username, role }));
  res.json({ users });
});

app.patch('/auth/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const { role } = req.body ?? {};
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }
  withWriteLock(async () => {
    const users = getCollection('users');
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    await persistDb(db);
    res.json({ id: user.id, username: user.username, role: user.role });
  }).catch(lockErr(res));
});

// ── Team routes ───────────────────────────────────────────────────────────────

app.post('/auth/teams', requireAuth, (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  withWriteLock(async () => {
    const team = { id: randomUUID(), name, ownerId: req.user.id, members: [req.user.id] };
    getCollection('teams').push(team);
    await persistDb(db);
    res.status(201).json(team);
  }).catch(lockErr(res));
});

app.get('/auth/teams', requireAuth, (req, res) => {
  res.json(getCollection('teams').filter(t => t.members.includes(req.user.id)));
});

app.get('/auth/teams/:id', requireAuth, (req, res) => {
  const team = getCollection('teams').find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(team);
});

app.patch('/auth/teams/:id', requireAuth, (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  withWriteLock(async () => {
    const team = getCollection('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    team.name = name;
    await persistDb(db);
    res.json(team);
  }).catch(lockErr(res));
});

app.delete('/auth/teams/:id', requireAuth, (req, res) => {
  withWriteLock(async () => {
    const teams = getCollection('teams');
    const idx = teams.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Team not found' });
    if (teams[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    teams.splice(idx, 1);
    await persistDb(db);
    res.status(200).json({ deleted: true });
  }).catch(lockErr(res));
});

app.post('/auth/teams/:id/members', requireAuth, (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  withWriteLock(async () => {
    const team = getCollection('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!team.members.includes(userId)) team.members.push(userId);
    await persistDb(db);
    res.json(team);
  }).catch(lockErr(res));
});

app.delete('/auth/teams/:id/members/:userId', requireAuth, (req, res) => {
  withWriteLock(async () => {
    const team = getCollection('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const memberIdx = team.members.indexOf(req.params.userId);
    if (memberIdx === -1) return res.status(404).json({ error: 'Member not found' });
    team.members.splice(memberIdx, 1);
    await persistDb(db);
    res.json(team);
  }).catch(lockErr(res));
});

// ── RBAC / ownership helpers ──────────────────────────────────────────────────

function getUserTeamIds(userId) {
  return new Set(getCollection('teams').filter(t => t.members.includes(userId)).map(t => t.id));
}

// Returns 'owner', 'write', 'read', or null.
// Accepts a pre-computed Set<teamId> to avoid repeated collection scans per item.
function getAccess(item, user, userTeamIds) {
  if (user.role === 'admin' || item.ownerId === user.id) return 'owner';

  const directAccess = (item.sharedWith ?? []).find(s => s.userId === user.id)?.access ?? null;

  let teamAccess = null;
  for (const { teamId, access } of (item.sharedWithTeams ?? [])) {
    if (userTeamIds.has(teamId)) {
      if (access === 'write') { teamAccess = 'write'; break; }
      teamAccess = 'read';
    }
  }

  if (directAccess === 'write' || teamAccess === 'write') return 'write';
  if (directAccess === 'read'  || teamAccess === 'read')  return 'read';
  return null;
}

const VALID_ACCESS = new Set(['read', 'write']);

function validateSharedWith(v) {
  return Array.isArray(v) && v.every(e => typeof e.userId === 'string' && VALID_ACCESS.has(e.access));
}

function validateSharedWithTeams(v) {
  return Array.isArray(v) && v.every(e => typeof e.teamId === 'string' && VALID_ACCESS.has(e.access));
}

function validateSharingFields(body, res) {
  if (body.sharedWith !== undefined && !validateSharedWith(body.sharedWith)) {
    res.status(400).json({ error: 'Invalid sharedWith' }); return false;
  }
  if (body.sharedWithTeams !== undefined && !validateSharedWithTeams(body.sharedWithTeams)) {
    res.status(400).json({ error: 'Invalid sharedWithTeams' }); return false;
  }
  return true;
}

function stripSystemFields(body) {
  const { id: _id, ownerId: _o, createdAt: _ca, updatedAt: _ua, ...rest } = body ?? {};
  return rest;
}

// Returns a timestamp strictly after `after`, guaranteeing updatedAt !== createdAt.
function nextTimestamp(after) {
  const now = new Date().toISOString();
  return now > after ? now : new Date(new Date(after).getTime() + 1).toISOString();
}

// ── Query helpers ─────────────────────────────────────────────────────────────

const QUERY_RESERVED = new Set(['_sort', '_order', '_limit', '_offset', '_or']);

// Coerces a raw query-string value to boolean > number > string.
function coerce(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  return (raw !== '' && !isNaN(n)) ? n : raw;
}

function applyFilter(item, { field, op, raw }) {
  const iv = item[field];
  switch (op) {
    case 'eq':         return iv === coerce(raw);
    case 'ne':         return iv !== coerce(raw);
    case 'gt':         return Number(iv) > Number(raw);
    case 'gte':        return Number(iv) >= Number(raw);
    case 'lt':         return Number(iv) < Number(raw);
    case 'lte':        return Number(iv) <= Number(raw);
    case 'between': {
      const [lo, hi] = raw.split(',').map(Number);
      return Number(iv) >= lo && Number(iv) <= hi;
    }
    case 'contains':   return iv != null && String(iv).toLowerCase().includes(raw.toLowerCase());
    case 'startswith': return iv != null && String(iv).toLowerCase().startsWith(raw.toLowerCase());
    case 'endswith':   return iv != null && String(iv).toLowerCase().endsWith(raw.toLowerCase());
    case 'in':         return raw.split(',').map(coerce).includes(iv);
    default:           return true;
  }
}

function parseFilters(query) {
  const filters = [];
  for (const [key, value] of Object.entries(query)) {
    if (QUERY_RESERVED.has(key)) continue;
    const sep = key.lastIndexOf('__');
    filters.push({
      field: sep === -1 ? key : key.slice(0, sep),
      op:    sep === -1 ? 'eq' : key.slice(sep + 2),
      raw:   value,
    });
  }
  return filters;
}

// Applies filters, sort, and pagination to an already-ownership-filtered array.
// Returns { paginated, data, total, limit, offset }.
function applyQuery(items, query) {
  const filters = parseFilters(query);
  const isOr = query._or === 'true';

  let result = filters.length === 0
    ? items
    : items.filter(item =>
        isOr ? filters.some(f => applyFilter(item, f))
             : filters.every(f => applyFilter(item, f))
      );

  if (query._sort) {
    const field = query._sort;
    const dir   = query._order === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) =>
      a[field] < b[field] ? -dir : a[field] > b[field] ? dir : 0
    );
  }

  const hasPagination = query._limit != null || query._offset != null;
  if (!hasPagination) return { paginated: false, data: result };

  const limit  = query._limit  != null ? Math.max(0, parseInt(query._limit,  10)) : null;
  const offset = query._offset != null ? Math.max(0, parseInt(query._offset, 10)) : 0;
  const total  = result.length;
  const data   = result.slice(offset, limit != null ? offset + limit : undefined);
  return { paginated: true, data, total, limit: limit ?? data.length, offset };
}

// ── Dynamic CRUD routes ───────────────────────────────────────────────────────

// GET /:resource — list all (with ownership, query filters, sort, pagination)
app.get('/:resource', requireAuth, blockReserved, (req, res) => {
  const col = getCollection(req.params.resource);
  const base = req.user.role === 'admin'
    ? col
    : col.filter(i => getAccess(i, req.user, getUserTeamIds(req.user.id)) !== null);

  const { paginated, data, total, limit, offset } = applyQuery(base, req.query);
  return paginated ? res.json({ data, total, limit, offset }) : res.json(data);
});

// GET /:resource/:id — single item
app.get('/:resource/:id', requireAuth, blockReserved, (req, res) => {
  const col = getCollection(req.params.resource);
  const item = col.find(i => String(i.id) === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (!getAccess(item, req.user, getUserTeamIds(req.user.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(item);
});

// POST /:resource — create
app.post('/:resource', requireAuth, blockReserved, (req, res) => {
  const body = stripSystemFields(req.body);
  if (!validateSharingFields(body, res)) return;
  withWriteLock(async () => {
    const col = getCollection(req.params.resource);
    const item = { ...body, id: randomUUID(), ownerId: req.user.id, createdAt: new Date().toISOString() };
    col.push(item);
    await persistDb(db);
    res.status(201).json(item);
  }).catch(lockErr(res));
});

// PUT /:resource/:id — full replace
app.put('/:resource/:id', requireAuth, blockReserved, (req, res) => {
  const body = stripSystemFields(req.body);
  if (!validateSharingFields(body, res)) return;
  withWriteLock(async () => {
    const col = getCollection(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const access = getAccess(col[idx], req.user, getUserTeamIds(req.user.id));
    if (!access || access === 'read') return res.status(403).json({ error: 'Forbidden' });
    // Only owner may update sharing; write grantees inherit existing values.
    const sharedWith      = access === 'owner' ? body.sharedWith      : col[idx].sharedWith;
    const sharedWithTeams = access === 'owner' ? body.sharedWithTeams : col[idx].sharedWithTeams;
    const { sharedWith: _sw, sharedWithTeams: _swt, ...rest } = body;
    col[idx] = {
      ...rest,
      id: col[idx].id, ownerId: col[idx].ownerId, createdAt: col[idx].createdAt,
      updatedAt: nextTimestamp(col[idx].createdAt),
      ...(sharedWith      !== undefined && { sharedWith }),
      ...(sharedWithTeams !== undefined && { sharedWithTeams }),
    };
    await persistDb(db);
    res.json(col[idx]);
  }).catch(lockErr(res));
});

// PATCH /:resource/:id — partial update
app.patch('/:resource/:id', requireAuth, blockReserved, (req, res) => {
  const body = stripSystemFields(req.body);
  if (!validateSharingFields(body, res)) return;
  withWriteLock(async () => {
    const col = getCollection(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const access = getAccess(col[idx], req.user, getUserTeamIds(req.user.id));
    if (!access || access === 'read') return res.status(403).json({ error: 'Forbidden' });
    if (access !== 'owner') { delete body.sharedWith; delete body.sharedWithTeams; }
    col[idx] = {
      ...col[idx], ...body,
      id: col[idx].id, ownerId: col[idx].ownerId, createdAt: col[idx].createdAt,
      updatedAt: nextTimestamp(col[idx].createdAt),
    };
    await persistDb(db);
    res.json(col[idx]);
  }).catch(lockErr(res));
});

// DELETE /:resource/:id
app.delete('/:resource/:id', requireAuth, blockReserved, (req, res) => {
  withWriteLock(async () => {
    const col = getCollection(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (getAccess(col[idx], req.user, getUserTeamIds(req.user.id)) !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    col.splice(idx, 1);
    await persistDb(db);
    res.status(200).json({ deleted: true });
  }).catch(lockErr(res));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
