const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const JWT_EXPIRES_IN_SECONDS = 60 * 60;
const defaultData = { _users: [], _teams: [] };
let fileOperationQueue = Promise.resolve();

function enqueueFileOp(fn) {
  const operation = fileOperationQueue.then(() => Promise.resolve(fn())).catch(() => Promise.resolve(fn()));
  fileOperationQueue = operation.catch(() => {});
  return operation;
}

const app = express();
app.use(express.json());

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return `${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const [salt, hash] = storedHash.split('$');
  if (!salt || !hash) {
    return false;
  }

  const derived = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function base64UrlDecode(value) {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerEncoded, payloadEncoded, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or invalid' });
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyJwt(token, JWT_SECRET);
  if (!payload || !payload.sub || !payload.username || !payload.role) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = {
    id: payload.sub,
    username: payload.username,
    role: payload.role,
  };
  return next();
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8').trim();
  return contents ? JSON.parse(contents) : null;
}

function writeJsonFile(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
}

function validateDatabase(db) {
  if (!db || typeof db !== 'object' || Array.isArray(db)) {
    throw new Error('Database file must contain a JSON object');
  }

  for (const [key, value] of Object.entries(db)) {
    if (!Array.isArray(value)) {
      throw new Error(`Database collection "${key}" must be an array`);
    }
  }
}

function loadDatabase() {
  if (!fileExists(DB_PATH)) {
    return { ...defaultData };
  }

  const data = readJsonFile(DB_PATH);
  if (data === null) {
    return { ...defaultData };
  }

  validateDatabase(data);
  return data;
}

function initializeDatabase() {
  const db = loadDatabase();
  if (!fileExists(DB_PATH) || readJsonFile(DB_PATH) === null) {
    writeJsonFile(DB_PATH, db);
  }
  return db;
}

function saveDatabase(db) {
  return enqueueFileOp(() => {
    validateDatabase(db);
    writeJsonFile(DB_PATH, db);
  });
}

function ensureCollection(db, resource) {
  if (!Array.isArray(db[resource])) {
    db[resource] = [];
  }
  return db[resource];
}

function isReservedCollection(resource) {
  return resource === '_users' || resource === '_teams';
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function sanitizeSharedWith(sharedWith) {
  if (!Array.isArray(sharedWith)) {
    return [];
  }

  return sharedWith
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      userId: String(entry.userId),
      access: entry.access === 'write' ? 'write' : 'read',
    }))
    .filter(entry => entry.userId && (entry.access === 'read' || entry.access === 'write'));
}

function sanitizeSharedWithTeams(sharedWithTeams) {
  if (!Array.isArray(sharedWithTeams)) {
    return [];
  }

  return sharedWithTeams
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      teamId: String(entry.teamId),
      access: entry.access === 'write' ? 'write' : 'read',
    }))
    .filter(entry => entry.teamId && (entry.access === 'read' || entry.access === 'write'));
}

function getSharedAccess(item, userId) {
  if (!Array.isArray(item.sharedWith)) {
    return null;
  }

  const entry = item.sharedWith.find(entry => String(entry.userId) === String(userId));
  return entry ? entry.access : null;
}

function getSharedTeamAccess(item, teamIds) {
  if (!Array.isArray(item.sharedWithTeams) || !Array.isArray(teamIds)) {
    return null;
  }

  let access = null;
  for (const entry of item.sharedWithTeams) {
    if (entry && teamIds.includes(String(entry.teamId))) {
      if (entry.access === 'write') {
        return 'write';
      }
      if (entry.access === 'read') {
        access = 'read';
      }
    }
  }
  return access;
}

function getTeamIdsForUser(userId, db) {
  const teams = ensureCollection(db, '_teams');
  return teams
    .filter(team => Array.isArray(team.members) && team.members.map(member => String(member)).includes(String(userId)))
    .map(team => String(team.id));
}

function getAccessLevel(item, req, db) {
  if (req.user.role === 'admin') {
    return 'admin';
  }
  if (String(item.ownerId) === String(req.user.id)) {
    return 'owner';
  }

  const teamIds = getTeamIdsForUser(req.user.id, db);
  const userAccess = getSharedAccess(item, req.user.id);
  const teamAccess = getSharedTeamAccess(item, teamIds);

  if (userAccess === 'write' || teamAccess === 'write') {
    return 'write';
  }
  if (userAccess === 'read' || teamAccess === 'read') {
    return 'read';
  }
  return null;
}

function parseQueryParam(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw).trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function parseQueryList(value) {
  const raw = Array.isArray(value) ? value.flat() : value;
  return String(raw)
    .split(',')
    .map(item => parseQueryParam(item));
}

function matchFilter(item, field, op, rawValue) {
  const itemValue = item[field];
  const value = op === 'in' || op === 'between' ? rawValue : parseQueryParam(rawValue);

  switch (op) {
    case 'ne':
      return itemValue !== value;
    case 'gt':
      return Number(itemValue) > Number(value);
    case 'gte':
      return Number(itemValue) >= Number(value);
    case 'lt':
      return Number(itemValue) < Number(value);
    case 'lte':
      return Number(itemValue) <= Number(value);
    case 'between': {
      const [low, high] = String(rawValue).split(',').map(parseFloat);
      if (Number.isNaN(low) || Number.isNaN(high)) return false;
      return Number(itemValue) >= low && Number(itemValue) <= high;
    }
    case 'contains':
      return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
    case 'startswith':
      return String(itemValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'endswith':
      return String(itemValue).toLowerCase().endsWith(String(value).toLowerCase());
    case 'in': {
      const values = parseQueryList(rawValue);
      return values.some(v => String(itemValue) === String(v));
    }
    default:
      return String(itemValue) === String(value);
  }
}

function buildQueryPredicates(query) {
  const reserved = new Set(['_sort', '_order', '_limit', '_offset', '_or']);
  const predicates = [];

  for (const [key, value] of Object.entries(query)) {
    if (reserved.has(key)) continue;
    const parts = key.split('__');
    const field = parts.shift();
    const op = parts.length ? parts.join('__') : 'eq';
    predicates.push(item => matchFilter(item, field, op, value));
  }

  return predicates;
}

function applyQuery(items, query) {
  const predicates = buildQueryPredicates(query);
  if (!predicates.length) {
    return items;
  }

  const useOr = String(query._or) === 'true';
  return items.filter(item =>
    useOr ? predicates.some(pred => pred(item)) : predicates.every(pred => pred(item)),
  );
}

function sortItems(items, query) {
  const sort = query._sort;
  if (!sort) return items;

  const order = String(query._order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const aValue = a[sort];
    const bValue = b[sort];
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * order;
    }

    return String(aValue).localeCompare(String(bValue)) * order;
  });
}

function paginateItems(items, query) {
  const limit = Number.isFinite(Number(query._limit)) ? Math.max(0, Number(query._limit)) : undefined;
  const offset = Number.isFinite(Number(query._offset)) ? Math.max(0, Number(query._offset)) : 0;
  const total = items.length;

  if (limit === undefined && offset === 0) {
    return { data: items, total, limit: undefined, offset: 0 };
  }

  const data = items.slice(offset, limit === undefined ? undefined : offset + limit);
  return { data, total, limit, offset };
}

function findItemById(collection, id) {
  return collection.find(item => String(item.id) === String(id));
}

function createResourceItem(body, ownerId, collection) {
  const now = new Date().toISOString();
  const item = { ...body };
  delete item.id;
  delete item.ownerId;
  delete item.createdAt;
  delete item.updatedAt;

  return {
    ...item,
    id: generateUniqueId(collection),
    ownerId,
    createdAt: now,
    sharedWith: sanitizeSharedWith(item.sharedWith),
    sharedWithTeams: sanitizeSharedWithTeams(item.sharedWithTeams),
  };
}

function generateUniqueId(collection) {
  const numericIds = collection
    .map(item => Number(item && item.id))
    .filter(id => Number.isFinite(id));

  if (numericIds.length > 0) {
    return String(Math.max(...numericIds) + 1);
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const db = loadDatabase();
  const users = ensureCollection(db, '_users');
  if (users.some(user => user.username === username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const role = users.length === 0 ? 'admin' : 'user';
  const newUser = {
    id: generateUniqueId(users),
    username,
    role,
    passwordHash: hashPassword(password),
  };

  users.push(newUser);
  await saveDatabase(db);

  return res.status(201).json({
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
    },
  });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const db = loadDatabase();
  const users = ensureCollection(db, '_users');
  const user = users.find(entry => entry.username === username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      iat: now,
      exp: now + JWT_EXPIRES_IN_SECONDS,
    },
    JWT_SECRET,
  );

  return res.status(200).json({ token });
});

app.get('/auth/me', authMiddleware, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
  });
});

app.get('/auth/users', authMiddleware, requireAdmin, (req, res) => {
  const db = loadDatabase();
  const users = ensureCollection(db, '_users').map(sanitizeUser);
  return res.status(200).json({ users });
});

app.post('/auth/teams', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const newTeam = {
    id: generateUniqueId(teams),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
  };

  teams.push(newTeam);
  await saveDatabase(db);
  return res.status(201).json({ team: newTeam });
});

app.post('/auth/teams/:id/members', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const team = findItemById(teams, id);
  if (!team) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!Array.isArray(team.members)) {
    team.members = [];
  }

  const normalizedId = String(userId);
  if (!team.members.map(member => String(member)).includes(normalizedId)) {
    team.members.push(normalizedId);
  }

  await saveDatabase(db);
  return res.status(200).json({ team });
});

app.delete('/auth/teams/:id/members/:userId', authMiddleware, async (req, res) => {
  const { id, userId } = req.params;
  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const team = findItemById(teams, id);
  if (!team) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!Array.isArray(team.members)) {
    team.members = [];
  }

  team.members = team.members.filter(member => String(member) !== String(userId));
  await saveDatabase(db);
  return res.status(200).json({ team });
});

app.get('/auth/teams', authMiddleware, (req, res) => {
  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const userTeams = teams.filter(team => Array.isArray(team.members) && team.members.map(member => String(member)).includes(String(req.user.id)));
  return res.status(200).json({ teams: userTeams });
});

app.get('/auth/teams/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const team = findItemById(teams, id);
  if (!team) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!Array.isArray(team.members) || !team.members.map(member => String(member)).includes(String(req.user.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.status(200).json({ team });
});

app.patch('/auth/teams/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const team = findItemById(teams, id);
  if (!team) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  team.name = name;
  await saveDatabase(db);
  return res.status(200).json({ team });
});

app.delete('/auth/teams/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const teams = ensureCollection(db, '_teams');
  const index = teams.findIndex(team => String(team.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const team = teams[index];
  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  teams.splice(index, 1);
  await saveDatabase(db);
  return res.status(204).end();
});

app.patch('/auth/users/:id/role', authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role value' });
  }

  const db = loadDatabase();
  const users = ensureCollection(db, '_users');
  const user = findItemById(users, id);
  if (!user) {
    return res.status(404).json({ error: 'Not found' });
  }

  user.role = role;
  await saveDatabase(db);
  return res.status(200).json(sanitizeUser(user));
});

app.use('/:resource', authMiddleware);

app.get('/:resource', (req, res) => {
  const resource = req.params.resource;
  if (isReservedCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = loadDatabase();
  const collection = db[resource];
  const items = Array.isArray(collection) ? collection : [];

  const authorizedItems = req.user.role === 'admin'
    ? items
    : items.filter(item => getAccessLevel(item, req, db) !== null);

  const filtered = applyQuery(authorizedItems, req.query);
  const sorted = sortItems(filtered, req.query);
  const pagination = paginateItems(sorted, req.query);
  const usePagination = req.query._limit !== undefined || req.query._offset !== undefined;

  if (usePagination) {
    return res.json({
      data: pagination.data,
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  return res.json(sorted);
});

app.get('/:resource/:id', (req, res) => {
  const { resource, id } = req.params;
  if (isReservedCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = loadDatabase();
  const collection = db[resource];

  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const item = findItemById(collection, id);
  if (!item) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (getAccessLevel(item, req, db) === null) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(item);
});

app.post('/:resource', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const db = loadDatabase();
  const collection = ensureCollection(db, resource);
  const item = createResourceItem(body, req.user.id, collection);
  collection.push(item);
  await saveDatabase(db);

  res.status(201).json(item);
});

app.put('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  if (isReservedCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const db = loadDatabase();
  const collection = db[resource];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const index = collection.findIndex(item => String(item.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const existing = collection[index];
  const access = getAccessLevel(existing, req, db);
  if (access !== 'admin' && access !== 'owner' && access !== 'write') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const isOwner = String(existing.ownerId) === String(req.user.id);
  const updatedItem = {
    ...existing,
    ...body,
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    sharedWith: isOwner ? sanitizeSharedWith(body.sharedWith ?? existing.sharedWith) : existing.sharedWith,
    sharedWithTeams: isOwner ? sanitizeSharedWithTeams(body.sharedWithTeams ?? existing.sharedWithTeams) : existing.sharedWithTeams,
  };

  collection[index] = updatedItem;
  await saveDatabase(db);

  res.json(updatedItem);
});

app.patch('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  if (isReservedCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const db = loadDatabase();
  const collection = db[resource];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const item = findItemById(collection, id);
  if (!item) {
    return res.status(404).json({ error: 'Not found' });
  }

  const access = getAccessLevel(item, req, db);
  if (access !== 'admin' && access !== 'owner' && access !== 'write') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const isOwner = String(item.ownerId) === String(req.user.id);
  const patchedItem = {
    ...item,
    ...body,
    id: item.id,
    ownerId: item.ownerId,
    createdAt: item.createdAt,
    updatedAt: new Date().toISOString(),
    sharedWith: isOwner ? sanitizeSharedWith(body.sharedWith ?? item.sharedWith) : item.sharedWith,
    sharedWithTeams: isOwner ? sanitizeSharedWithTeams(body.sharedWithTeams ?? item.sharedWithTeams) : item.sharedWithTeams,
  };
  const index = collection.findIndex(entry => String(entry.id) === String(id));
  collection[index] = patchedItem;
  await saveDatabase(db);

  res.json(patchedItem);
});

app.delete('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  if (isReservedCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = loadDatabase();
  const collection = db[resource];

  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const index = collection.findIndex(item => String(item.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const item = collection[index];
  if (req.user.role !== 'admin' && item.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  collection.splice(index, 1);
  await saveDatabase(db);

  res.status(204).end();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

try {
  initializeDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`running on ${PORT}`);
});
