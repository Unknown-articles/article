'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const TOKEN_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const HASH_ROUNDS = 10;

const SERVER_PORT = process.env.PORT || 4000;
const DATA_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;

const EMPTY_STORE = { _users: [], _teams: [] };

// ── Store helpers ─────────────────────────────────────────────────────────────

function readStore() {
  if (!DATA_PATH) {
    console.warn('DB_PATH not set; using in-memory default.');
    return structuredClone(EMPTY_STORE);
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(EMPTY_STORE, null, 2));
    return structuredClone(EMPTY_STORE);
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf8').trim();
  if (!raw) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(EMPTY_STORE, null, 2));
    return structuredClone(EMPTY_STORE);
  }
  return JSON.parse(raw);
}

async function saveStore(store) {
  if (!DATA_PATH) return;
  const tmp = DATA_PATH + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(store, null, 2));
  await fs.promises.rename(tmp, DATA_PATH);
}

// ── In-memory store ───────────────────────────────────────────────────────────

const store = readStore();

function storeKey(resource) { return `_${resource}`; }

function fetchCollection(resource) {
  const key = storeKey(resource);
  if (!Array.isArray(store[key])) store[key] = [];
  return store[key];
}

// ── Mutation queue (serialises all mutations) ─────────────────────────────────

let mutationQueue = Promise.resolve();

function queueMutation(fn) {
  const next = mutationQueue.then(fn);
  mutationQueue = next.then(() => {}, () => {});
  return next;
}

function mutationError(res) {
  return () => { if (!res.headersSent) res.status(500).json({ error: 'Server error' }); };
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ── Auth middleware ───────────────────────────────────────────────────────────

function verifyToken(req, res, next) {
  const header = req.headers['authorization'] ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, TOKEN_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function verifyAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

const PROTECTED_COLLECTIONS = new Set(['users', 'teams', '_users', '_teams']);

function guardReserved(req, res, next) {
  if (PROTECTED_COLLECTIONS.has(req.params.resource)) {
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
  try { hash = await bcrypt.hash(password, HASH_ROUNDS); }
  catch { return res.status(500).json({ error: 'Server error' }); }

  queueMutation(async () => {
    const users = fetchCollection('users');
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const role = users.length === 0 ? 'admin' : 'user';
    const user = { id: randomUUID(), username, passwordHash: hash, role };
    users.push(user);
    await saveStore(store);
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  }).catch(mutationError(res));
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const users = fetchCollection('users');
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    TOKEN_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token });
});

app.get('/auth/me', verifyToken, (req, res) => {
  const { id, username, role } = req.user;
  res.json({ id, username, role });
});

app.get('/auth/users', verifyToken, verifyAdmin, (_req, res) => {
  const users = fetchCollection('users').map(({ id, username, role }) => ({ id, username, role }));
  res.json({ users });
});

app.patch('/auth/users/:id/role', verifyToken, verifyAdmin, (req, res) => {
  const { role } = req.body ?? {};
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }
  queueMutation(async () => {
    const users = fetchCollection('users');
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    await saveStore(store);
    res.json({ id: user.id, username: user.username, role: user.role });
  }).catch(mutationError(res));
});

// ── Team routes ───────────────────────────────────────────────────────────────

app.post('/auth/teams', verifyToken, (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  queueMutation(async () => {
    const team = { id: randomUUID(), name, ownerId: req.user.id, members: [req.user.id] };
    fetchCollection('teams').push(team);
    await saveStore(store);
    res.status(201).json(team);
  }).catch(mutationError(res));
});

app.get('/auth/teams', verifyToken, (req, res) => {
  res.json(fetchCollection('teams').filter(t => t.members.includes(req.user.id)));
});

app.get('/auth/teams/:id', verifyToken, (req, res) => {
  const team = fetchCollection('teams').find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(team);
});

app.patch('/auth/teams/:id', verifyToken, (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  queueMutation(async () => {
    const team = fetchCollection('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    team.name = name;
    await saveStore(store);
    res.json(team);
  }).catch(mutationError(res));
});

app.delete('/auth/teams/:id', verifyToken, (req, res) => {
  queueMutation(async () => {
    const teams = fetchCollection('teams');
    const idx = teams.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Team not found' });
    if (teams[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    teams.splice(idx, 1);
    await saveStore(store);
    res.status(200).json({ deleted: true });
  }).catch(mutationError(res));
});

app.post('/auth/teams/:id/members', verifyToken, (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  queueMutation(async () => {
    const team = fetchCollection('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!team.members.includes(userId)) team.members.push(userId);
    await saveStore(store);
    res.json(team);
  }).catch(mutationError(res));
});

app.delete('/auth/teams/:id/members/:userId', verifyToken, (req, res) => {
  queueMutation(async () => {
    const team = fetchCollection('teams').find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const memberIdx = team.members.indexOf(req.params.userId);
    if (memberIdx === -1) return res.status(404).json({ error: 'Member not found' });
    team.members.splice(memberIdx, 1);
    await saveStore(store);
    res.json(team);
  }).catch(mutationError(res));
});

// ── RBAC / ownership helpers ──────────────────────────────────────────────────

function fetchUserTeamIds(userId) {
  return new Set(fetchCollection('teams').filter(t => t.members.includes(userId)).map(t => t.id));
}

function resolveAccess(item, user, userTeamIds) {
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

const ALLOWED_ACCESS = new Set(['read', 'write']);

function checkSharedWith(v) {
  return Array.isArray(v) && v.every(e => typeof e.userId === 'string' && ALLOWED_ACCESS.has(e.access));
}

function checkSharedWithTeams(v) {
  return Array.isArray(v) && v.every(e => typeof e.teamId === 'string' && ALLOWED_ACCESS.has(e.access));
}

function checkSharingFields(body, res) {
  if (body.sharedWith !== undefined && !checkSharedWith(body.sharedWith)) {
    res.status(400).json({ error: 'Invalid sharedWith' }); return false;
  }
  if (body.sharedWithTeams !== undefined && !checkSharedWithTeams(body.sharedWithTeams)) {
    res.status(400).json({ error: 'Invalid sharedWithTeams' }); return false;
  }
  return true;
}

function removeSystemFields(body) {
  const { id: _id, ownerId: _o, createdAt: _ca, updatedAt: _ua, ...rest } = body ?? {};
  return rest;
}

function generateTimestamp(after) {
  const now = new Date().toISOString();
  return now > after ? now : new Date(new Date(after).getTime() + 1).toISOString();
}

// ── Query helpers ─────────────────────────────────────────────────────────────

const QUERY_PARAMS = new Set(['_sort', '_order', '_limit', '_offset', '_or']);

function castValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  return (raw !== '' && !isNaN(n)) ? n : raw;
}

function matchFilter(item, { field, op, raw }) {
  const iv = item[field];
  switch (op) {
    case 'eq':         return iv === castValue(raw);
    case 'ne':         return iv !== castValue(raw);
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
    case 'in':         return raw.split(',').map(castValue).includes(iv);
    default:           return true;
  }
}

function buildFilters(query) {
  const filters = [];
  for (const [key, value] of Object.entries(query)) {
    if (QUERY_PARAMS.has(key)) continue;
    const sep = key.lastIndexOf('__');
    filters.push({
      field: sep === -1 ? key : key.slice(0, sep),
      op:    sep === -1 ? 'eq' : key.slice(sep + 2),
      raw:   value,
    });
  }
  return filters;
}

function processQuery(items, query) {
  const filters = buildFilters(query);
  const isOr = query._or === 'true';

  let result = filters.length === 0
    ? items
    : items.filter(item =>
        isOr ? filters.some(f => matchFilter(item, f))
             : filters.every(f => matchFilter(item, f))
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

app.get('/:resource', verifyToken, guardReserved, (req, res) => {
  const col = fetchCollection(req.params.resource);
  const base = req.user.role === 'admin'
    ? col
    : col.filter(i => resolveAccess(i, req.user, fetchUserTeamIds(req.user.id)) !== null);

  const { paginated, data, total, limit, offset } = processQuery(base, req.query);
  return paginated ? res.json({ data, total, limit, offset }) : res.json(data);
});

app.get('/:resource/:id', verifyToken, guardReserved, (req, res) => {
  const col = fetchCollection(req.params.resource);
  const item = col.find(i => String(i.id) === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (!resolveAccess(item, req.user, fetchUserTeamIds(req.user.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(item);
});

app.post('/:resource', verifyToken, guardReserved, (req, res) => {
  const body = removeSystemFields(req.body);
  if (!checkSharingFields(body, res)) return;
  queueMutation(async () => {
    const col = fetchCollection(req.params.resource);
    const item = { ...body, id: randomUUID(), ownerId: req.user.id, createdAt: new Date().toISOString() };
    col.push(item);
    await saveStore(store);
    res.status(201).json(item);
  }).catch(mutationError(res));
});

app.put('/:resource/:id', verifyToken, guardReserved, (req, res) => {
  const body = removeSystemFields(req.body);
  if (!checkSharingFields(body, res)) return;
  queueMutation(async () => {
    const col = fetchCollection(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const access = resolveAccess(col[idx], req.user, fetchUserTeamIds(req.user.id));
    if (!access || access === 'read') return res.status(403).json({ error: 'Forbidden' });
    const sharedWith      = access === 'owner' ? body.sharedWith      : col[idx].sharedWith;
    const sharedWithTeams = access === 'owner' ? body.sharedWithTeams : col[idx].sharedWithTeams;
    const { sharedWith: _sw, sharedWithTeams: _swt, ...rest } = body;
    col[idx] = {
      ...rest,
      id: col[idx].id, ownerId: col[idx].ownerId, createdAt: col[idx].createdAt,
      updatedAt: generateTimestamp(col[idx].createdAt),
      ...(sharedWith      !== undefined && { sharedWith }),
      ...(sharedWithTeams !== undefined && { sharedWithTeams }),
    };
    await saveStore(store);
    res.json(col[idx]);
  }).catch(mutationError(res));
});

app.patch('/:resource/:id', verifyToken, guardReserved, (req, res) => {
  const body = removeSystemFields(req.body);
  if (!checkSharingFields(body, res)) return;
  queueMutation(async () => {
    const col = fetchCollection(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const access = resolveAccess(col[idx], req.user, fetchUserTeamIds(req.user.id));
    if (!access || access === 'read') return res.status(403).json({ error: 'Forbidden' });
    if (access !== 'owner') { delete body.sharedWith; delete body.sharedWithTeams; }
    col[idx] = {
      ...col[idx], ...body,
      id: col[idx].id, ownerId: col[idx].ownerId, createdAt: col[idx].createdAt,
      updatedAt: generateTimestamp(col[idx].createdAt),
    };
    await saveStore(store);
    res.json(col[idx]);
  }).catch(mutationError(res));
});

app.delete('/:resource/:id', verifyToken, guardReserved, (req, res) => {
  queueMutation(async () => {
    const col = fetchCollection(req.params.resource);
    const idx = col.findIndex(i => String(i.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (resolveAccess(col[idx], req.user, fetchUserTeamIds(req.user.id)) !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    col.splice(idx, 1);
    await saveStore(store);
    res.status(200).json({ deleted: true });
  }).catch(mutationError(res));
});

app.listen(SERVER_PORT, () => {
  console.log(`Server running on port ${SERVER_PORT}`);
});
