'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const AUTH_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BCRYPT_ROUNDS = 10;

const APP_PORT = process.env.PORT || 4000;
const STORAGE_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;

const INITIAL_STATE = { _users: [], _teams: [] };

// ── Data helpers ──────────────────────────────────────────────────────────────

function initializeData() {
  if (!STORAGE_PATH) {
    console.warn('DB_PATH not set; using in-memory default.');
    return structuredClone(INITIAL_STATE);
  }
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(INITIAL_STATE, null, 2));
    return structuredClone(INITIAL_STATE);
  }
  const raw = fs.readFileSync(STORAGE_PATH, 'utf8').trim();
  if (!raw) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(INITIAL_STATE, null, 2));
    return structuredClone(INITIAL_STATE);
  }
  return JSON.parse(raw);
}

async function commitData(dataStore) {
  if (!STORAGE_PATH) return;
  const tmp = STORAGE_PATH + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(dataStore, null, 2));
  await fs.promises.rename(tmp, STORAGE_PATH);
}

// ── In-memory data store ──────────────────────────────────────────────────────

const dataStore = initializeData();

function tableKey(resource) { return `_${resource}`; }

function getTable(resource) {
  const key = tableKey(resource);
  if (!Array.isArray(dataStore[key])) dataStore[key] = [];
  return dataStore[key];
}

// ── Operation chain (serialises all mutations) ────────────────────────────────

let operationChain = Promise.resolve();

function serialOperation(fn) {
  const next = operationChain.then(fn);
  operationChain = next.then(() => {}, () => {});
  return next;
}

function chainError(res) {
  return () => { if (!res.headersSent) res.status(500).json({ error: 'Server error' }); };
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ── Auth middleware ───────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const header = req.headers['authorization'] ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, AUTH_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorizeAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

const SYSTEM_COLLECTIONS = new Set(['users', 'teams', '_users', '_teams']);

function protectReserved(req, res, next) {
  if (SYSTEM_COLLECTIONS.has(req.params.resource)) {
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
  let hash;
  try { hash = await bcrypt.hash(password, BCRYPT_ROUNDS); }
  catch { return res.status(500).json({ error: 'Server error' }); }

  serialOperation(async () => {
    const users = getTable('users');
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const role = users.length === 0 ? 'admin' : 'user';
    const user = { id: randomUUID(), username, passwordHash: hash, role };
    users.push(user);
    await commitData(dataStore);
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  }).catch(chainError(res));
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const users = getTable('users');
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    AUTH_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token });
});

app.get('/auth/me', authenticate, (req, res) => {
  const { id, username, role } = req.user;
  res.json({ id, username, role });
});

app.get('/auth/users', authenticate, authorizeAdmin, (_req, res) => {
  const users = getTable('users').map(({ id, username, role }) => ({ id, username, role }));
  res.json({ users });
});

app.patch('/auth/users/:id/role', authenticate, authorizeAdmin, (req, res) => {
  const { role } = req.body ?? {};
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }
  serialOperation(async () => {
    const users = getTable('users');
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    await commitData(dataStore);
    res.json({ id: user.id, username: user.username, role: user.role });
  }).catch(chainError(res));
});

// ── Team routes ───────────────────────────────────────────────────────────────

app.post('/auth/teams', authenticate, (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  serialOperation(async () => {
    const team = { id: randomUUID(), name, ownerId: req.user.id, members: [req.user.id] };
    getTable('teams').push(team);
    await commitData(dataStore);
    res.status(201).json(team);
  }).catch(chainError(res));
});

app.get('/auth/teams', authenticate, (req, res) => {
  res.json(getTable('teams').filter(t => t.members.includes(req.user.id)));
});

app.get('/auth/teams/:id', authenticate, (req, res) => {
  const team = getTable('teams').find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(team);
});

app.patch('/auth/teams/:id', authenticate, (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  serialOperation(async () => {
    const team = getTable('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    team.name = name;
    await commitData(dataStore);
    res.json(team);
  }).catch(chainError(res));
});

app.delete('/auth/teams/:id', authenticate, (req, res) => {
  serialOperation(async () => {
    const teams = getTable('teams');
    const idx = teams.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Team not found' });
    if (teams[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    teams.splice(idx, 1);
    await commitData(dataStore);
    res.status(200).json({ deleted: true });
  }).catch(chainError(res));
});

app.post('/auth/teams/:id/members', authenticate, (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  serialOperation(async () => {
    const team = getTable('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!team.members.includes(userId)) team.members.push(userId);
    await commitData(dataStore);
    res.json(team);
  }).catch(chainError(res));
});

app.delete('/auth/teams/:id/members/:userId', authenticate, (req, res) => {
  serialOperation(async () => {
    const team = getTable('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const memberIdx = team.members.indexOf(req.params.userId);
    if (memberIdx === -1) return res.status(404).json({ error: 'Member not found' });
    team.members.splice(memberIdx, 1);
    await commitData(dataStore);
    res.json(team);
  }).catch(chainError(res));
});

// ── RBAC / ownership helpers ──────────────────────────────────────────────────

function retrieveUserTeams(userId) {
  return new Set(getTable('teams').filter(t => t.members.includes(userId)).map(t => t.id));
}

function checkPermission(item, user, userTeamIds) {
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

const ACCESS_LEVELS = new Set(['read', 'write']);

function isValidSharedWith(v) {
  return Array.isArray(v) && v.every(e => typeof e.userId === 'string' && ACCESS_LEVELS.has(e.access));
}

function isValidSharedWithTeams(v) {
  return Array.isArray(v) && v.every(e => typeof e.teamId === 'string' && ACCESS_LEVELS.has(e.access));
}

function isValidSharingFields(body, res) {
  if (body.sharedWith !== undefined && !isValidSharedWith(body.sharedWith)) {
    res.status(400).json({ error: 'Invalid sharedWith' }); return false;
  }
  if (body.sharedWithTeams !== undefined && !isValidSharedWithTeams(body.sharedWithTeams)) {
    res.status(400).json({ error: 'Invalid sharedWithTeams' }); return false;
  }
  return true;
}

function sanitizeFields(body) {
  const { id: _id, ownerId: _o, createdAt: _ca, updatedAt: _ua, ...rest } = body ?? {};
  return rest;
}

function createTimestamp(after) {
  const now = new Date().toISOString();
  return now > after ? now : new Date(new Date(after).getTime() + 1).toISOString();
}

// ── Query helpers ─────────────────────────────────────────────────────────────

const SYSTEM_PARAMS = new Set(['_sort', '_order', '_limit', '_offset', '_or']);

function convertValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  return (raw !== '' && !isNaN(n)) ? n : raw;
}

function testFilter(item, { field, op, raw }) {
  const iv = item[field];
  switch (op) {
    case 'eq':         return iv === convertValue(raw);
    case 'ne':         return iv !== convertValue(raw);
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
    case 'in':         return raw.split(',').map(convertValue).includes(iv);
    default:           return true;
  }
}

function extractFilters(query) {
  const filters = [];
  for (const [key, value] of Object.entries(query)) {
    if (SYSTEM_PARAMS.has(key)) continue;
    const sep = key.lastIndexOf('__');
    filters.push({
      field: sep === -1 ? key : key.slice(0, sep),
      op:    sep === -1 ? 'eq' : key.slice(sep + 2),
      raw:   value,
    });
  }
  return filters;
}

function executeQuery(items, query) {
  const filters = extractFilters(query);
  const isOr = query._or === 'true';

  let result = filters.length === 0
    ? items
    : items.filter(item =>
        isOr ? filters.some(f => testFilter(item, f))
             : filters.every(f => testFilter(item, f))
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

app.get('/:resource', authenticate, protectReserved, (req, res) => {
  const col = getTable(req.params.resource);
  const base = req.user.role === 'admin'
    ? col
    : col.filter(i => checkPermission(i, req.user, retrieveUserTeams(req.user.id)) !== null);

  const { paginated, data, total, limit, offset } = executeQuery(base, req.query);
  return paginated ? res.json({ data, total, limit, offset }) : res.json(data);
});

app.get('/:resource/:id', authenticate, protectReserved, (req, res) => {
  const col = getTable(req.params.resource);
  const item = col.find(i => String(i.id) === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (!checkPermission(item, req.user, retrieveUserTeams(req.user.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(item);
});

app.post('/:resource', authenticate, protectReserved, (req, res) => {
  const body = sanitizeFields(req.body);
  if (!isValidSharingFields(body, res)) return;
  serialOperation(async () => {
    const col = getTable(req.params.resource);
    const item = { ...body, id: randomUUID(), ownerId: req.user.id, createdAt: new Date().toISOString() };
    col.push(item);
    await commitData(dataStore);
    res.status(201).json(item);
  }).catch(chainError(res));
});

app.put('/:resource/:id', authenticate, protectReserved, (req, res) => {
  const body = sanitizeFields(req.body);
  if (!isValidSharingFields(body, res)) return;
  serialOperation(async () => {
    const col = getTable(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const access = checkPermission(col[idx], req.user, retrieveUserTeams(req.user.id));
    if (!access || access === 'read') return res.status(403).json({ error: 'Forbidden' });
    const sharedWith      = access === 'owner' ? body.sharedWith      : col[idx].sharedWith;
    const sharedWithTeams = access === 'owner' ? body.sharedWithTeams : col[idx].sharedWithTeams;
    const { sharedWith: _sw, sharedWithTeams: _swt, ...rest } = body;
    col[idx] = {
      ...rest,
      id: col[idx].id, ownerId: col[idx].ownerId, createdAt: col[idx].createdAt,
      updatedAt: createTimestamp(col[idx].createdAt),
      ...(sharedWith      !== undefined && { sharedWith }),
      ...(sharedWithTeams !== undefined && { sharedWithTeams }),
    };
    await commitData(dataStore);
    res.json(col[idx]);
  }).catch(chainError(res));
});

app.patch('/:resource/:id', authenticate, protectReserved, (req, res) => {
  const body = sanitizeFields(req.body);
  if (!isValidSharingFields(body, res)) return;
  serialOperation(async () => {
    const col = getTable(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const access = checkPermission(col[idx], req.user, retrieveUserTeams(req.user.id));
    if (!access || access === 'read') return res.status(403).json({ error: 'Forbidden' });
    if (access !== 'owner') { delete body.sharedWith; delete body.sharedWithTeams; }
    col[idx] = {
      ...col[idx], ...body,
      id: col[idx].id, ownerId: col[idx].ownerId, createdAt: col[idx].createdAt,
      updatedAt: createTimestamp(col[idx].createdAt),
    };
    await commitData(dataStore);
    res.json(col[idx]);
  }).catch(chainError(res));
});

app.delete('/:resource/:id', authenticate, protectReserved, (req, res) => {
  serialOperation(async () => {
    const col = getTable(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (checkPermission(col[idx], req.user, retrieveUserTeams(req.user.id)) !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    col.splice(idx, 1);
    await commitData(dataStore);
    res.status(200).json({ deleted: true });
  }).catch(chainError(res));
});

app.listen(APP_PORT, () => {
  console.log(`Server running on port ${APP_PORT}`);
});
