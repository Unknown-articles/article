const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE_PATH = process.env.DB_FILE_PATH || path.join(__dirname, 'db.json');
const ACCESS_SECRET = process.env.ACCESS_SECRET || 'dev-secret-change-this';
const ACCESS_TOKEN_TTL = 60 * 60;
const defaultData = { _users: [], _teams: [] };
let diskQueue = Promise.resolve();

function scheduleWrite(fn) {
  const operation = diskQueue.then(() => Promise.resolve(fn())).catch(() => Promise.resolve(fn()));
  diskQueue = operation.catch(() => {});
  return operation;
}

const app = express();
app.use(express.json());

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function buildJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = toBase64Url(JSON.stringify(header));
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function securePassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return `${salt}$${derived}`;
}

function verifyPasswordHash(password, storedHash) {
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

function fromBase64Url(value) {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function checkJwt(token, secret) {
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
    const payload = JSON.parse(fromBase64Url(payloadEncoded));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or invalid' });
  }

  const token = authHeader.slice(7).trim();
  const payload = checkJwt(token, ACCESS_SECRET);
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

function pathExists(filePath) {
  return fs.existsSync(filePath);
}

function loadJsonFromFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8').trim();
  return contents ? JSON.parse(contents) : null;
}

function saveJsonToFile(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
}

function ensureDatabaseStructure(db) {
  if (!db || typeof db !== 'object' || Array.isArray(db)) {
    throw new Error('Database file must contain a JSON object');
  }

  for (const [key, value] of Object.entries(db)) {
    if (!Array.isArray(value)) {
      throw new Error(`Database collection "${key}" must be an array`);
    }
  }
}

function loadDatabaseFile() {
  if (!pathExists(DB_FILE_PATH)) {
    return { ...defaultData };
  }

  const data = loadJsonFromFile(DB_FILE_PATH);
  if (data === null) {
    return { ...defaultData };
  }

  ensureDatabaseStructure(data);
  return data;
}

function setupDatabase() {
  const db = loadDatabaseFile();
  if (!pathExists(DB_FILE_PATH) || loadJsonFromFile(DB_FILE_PATH) === null) {
    saveJsonToFile(DB_FILE_PATH, db);
  }
  return db;
}

function writeDatabase(db) {
  return scheduleWrite(() => {
    ensureDatabaseStructure(db);
    saveJsonToFile(DB_FILE_PATH, db);
  });
}

function ensureCollectionExists(db, resource) {
  if (!Array.isArray(db[resource])) {
    db[resource] = [];
  }
  return db[resource];
}

function isInternalCollection(resource) {
  return resource === '_users' || resource === '_teams';
}

function ensureAdminLevel(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

function cleanUserForResponse(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function formatSharedWith(sharedWith) {
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

function formatSharedWithTeams(sharedWithTeams) {
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

function accessForUser(item, userId) {
  if (!Array.isArray(item.sharedWith)) {
    return null;
  }

  const entry = item.sharedWith.find(entry => String(entry.userId) === String(userId));
  return entry ? entry.access : null;
}

function accessForTeam(item, teamIds) {
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

function teamsForUser(userId, db) {
  const teams = ensureCollectionExists(db, '_teams');
  return teams
    .filter(team => Array.isArray(team.members) && team.members.map(member => String(member)).includes(String(userId)))
    .map(team => String(team.id));
}

function computeAccessRights(item, req, db) {
  if (req.user.role === 'admin') {
    return 'admin';
  }
  if (String(item.ownerId) === String(req.user.id)) {
    return 'owner';
  }

  const teamIds = teamsForUser(req.user.id, db);
  const userAccess = accessForUser(item, req.user.id);
  const teamAccess = accessForTeam(item, teamIds);

  if (userAccess === 'write' || teamAccess === 'write') {
    return 'write';
  }
  if (userAccess === 'read' || teamAccess === 'read') {
    return 'read';
  }
  return null;
}

function parseQueryParamValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw).trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function parseListQuery(value) {
  const raw = Array.isArray(value) ? value.flat() : value;
  return String(raw)
    .split(',')
    .map(item => parseQueryParamValue(item));
}

function doesItemMatchFilter(item, field, op, rawValue) {
  const itemValue = item[field];
  const value = op === 'in' || op === 'between' ? rawValue : parseQueryParamValue(rawValue);

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
      const values = parseListQuery(rawValue);
      return values.some(v => String(itemValue) === String(v));
    }
    default:
      return String(itemValue) === String(value);
  }
}

function buildItemPredicates(query) {
  const reserved = new Set(['_sort', '_order', '_limit', '_offset', '_or']);
  const predicates = [];

  for (const [key, value] of Object.entries(query)) {
    if (reserved.has(key)) continue;
    const parts = key.split('__');
    const field = parts.shift();
    const op = parts.length ? parts.join('__') : 'eq';
    predicates.push(item => doesItemMatchFilter(item, field, op, value));
  }

  return predicates;
}

function applyFilters(items, query) {
  const predicates = buildItemPredicates(query);
  if (!predicates.length) {
    return items;
  }

  const useOr = String(query._or) === 'true';
  return items.filter(item =>
    useOr ? predicates.some(pred => pred(item)) : predicates.every(pred => pred(item)),
  );
}

function sortResults(items, query) {
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

function paginateResults(items, query) {
  const limit = Number.isFinite(Number(query._limit)) ? Math.max(0, Number(query._limit)) : undefined;
  const offset = Number.isFinite(Number(query._offset)) ? Math.max(0, Number(query._offset)) : 0;
  const total = items.length;

  if (limit === undefined && offset === 0) {
    return { data: items, total, limit: undefined, offset: 0 };
  }

  const data = items.slice(offset, limit === undefined ? undefined : offset + limit);
  return { data, total, limit, offset };
}

function fetchItemById(collection, id) {
  return collection.find(item => String(item.id) === String(id));
}

function buildResourceItem(body, ownerId, collection) {
  const now = new Date().toISOString();
  const item = { ...body };
  delete item.id;
  delete item.ownerId;
  delete item.createdAt;
  delete item.updatedAt;

  return {
    ...item,
    id: generateUniqueIdentifier(collection),
    ownerId,
    createdAt: now,
    sharedWith: formatSharedWith(item.sharedWith),
    sharedWithTeams: formatSharedWithTeams(item.sharedWithTeams),
  };
}

function generateUniqueIdentifier(collection) {
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

  const db = loadDatabaseFile();
  const users = ensureCollectionExists(db, '_users');
  if (users.some(user => user.username === username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const role = users.length === 0 ? 'admin' : 'user';
  const newUser = {
    id: generateUniqueIdentifier(users),
    username,
    role,
    passwordHash: securePassword(password),
  };

  users.push(newUser);
  await writeDatabase(db);

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

  const db = loadDatabaseFile();
  const users = ensureCollectionExists(db, '_users');
  const user = users.find(entry => entry.username === username);
  if (!user || !verifyPasswordHash(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = buildJwt(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL,
    },
    ACCESS_SECRET,
  );

  return res.status(200).json({ token });
});

app.get('/auth/me', authenticateRequest, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
  });
});

app.get('/auth/users', authenticateRequest, ensureAdminLevel, (req, res) => {
  const db = loadDatabaseFile();
  const users = ensureCollectionExists(db, '_users').map(cleanUserForResponse);
  return res.status(200).json({ users });
});

app.post('/auth/teams', authenticateRequest, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const newTeam = {
    id: generateUniqueIdentifier(teams),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
  };

  teams.push(newTeam);
  await writeDatabase(db);
  return res.status(201).json({ team: newTeam });
});

app.post('/auth/teams/:id/members', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const team = fetchItemById(teams, id);
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

  await writeDatabase(db);
  return res.status(200).json({ team });
});

app.delete('/auth/teams/:id/members/:userId', authenticateRequest, async (req, res) => {
  const { id, userId } = req.params;
  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const team = fetchItemById(teams, id);
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
  await writeDatabase(db);
  return res.status(200).json({ team });
});

app.get('/auth/teams', authenticateRequest, (req, res) => {
  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const userTeams = teams.filter(team => Array.isArray(team.members) && team.members.map(member => String(member)).includes(String(req.user.id)));
  return res.status(200).json({ teams: userTeams });
});

app.get('/auth/teams/:id', authenticateRequest, (req, res) => {
  const { id } = req.params;
  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const team = fetchItemById(teams, id);
  if (!team) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!Array.isArray(team.members) || !team.members.map(member => String(member)).includes(String(req.user.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.status(200).json({ team });
});

app.patch('/auth/teams/:id', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const team = fetchItemById(teams, id);
  if (!team) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  team.name = name;
  await writeDatabase(db);
  return res.status(200).json({ team });
});

app.delete('/auth/teams/:id', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  const db = loadDatabaseFile();
  const teams = ensureCollectionExists(db, '_teams');
  const index = teams.findIndex(team => String(team.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const team = teams[index];
  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  teams.splice(index, 1);
  await writeDatabase(db);
  return res.status(204).end();
});

app.patch('/auth/users/:id/role', authenticateRequest, ensureAdminLevel, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role value' });
  }

  const db = loadDatabaseFile();
  const users = ensureCollectionExists(db, '_users');
  const user = fetchItemById(users, id);
  if (!user) {
    return res.status(404).json({ error: 'Not found' });
  }

  user.role = role;
  await writeDatabase(db);
  return res.status(200).json(cleanUserForResponse(user));
});

app.use('/:resource', authenticateRequest);

app.get('/:resource', (req, res) => {
  const resource = req.params.resource;
  if (isInternalCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = loadDatabaseFile();
  const collection = db[resource];
  const items = Array.isArray(collection) ? collection : [];

  const authorizedItems = req.user.role === 'admin'
    ? items
    : items.filter(item => computeAccessRights(item, req, db) !== null);

  const filtered = applyFilters(authorizedItems, req.query);
  const sorted = sortResults(filtered, req.query);
  const pagination = paginateResults(sorted, req.query);
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
  if (isInternalCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = loadDatabaseFile();
  const collection = db[resource];

  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const item = fetchItemById(collection, id);
  if (!item) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (computeAccessRights(item, req, db) === null) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(item);
});

app.post('/:resource', async (req, res) => {
  const resource = req.params.resource;
  if (isInternalCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const db = loadDatabaseFile();
  const collection = ensureCollectionExists(db, resource);
  const item = buildResourceItem(body, req.user.id, collection);
  collection.push(item);
  await writeDatabase(db);

  res.status(201).json(item);
});

app.put('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  if (isInternalCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const db = loadDatabaseFile();
  const collection = db[resource];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const index = collection.findIndex(item => String(item.id) === String(id));
  if (index === -1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const existing = collection[index];
  const access = computeAccessRights(existing, req, db);
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
    sharedWith: isOwner ? formatSharedWith(body.sharedWith ?? existing.sharedWith) : existing.sharedWith,
    sharedWithTeams: isOwner ? formatSharedWithTeams(body.sharedWithTeams ?? existing.sharedWithTeams) : existing.sharedWithTeams,
  };

  collection[index] = updatedItem;
  await writeDatabase(db);

  res.json(updatedItem);
});

app.patch('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  if (isInternalCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const db = loadDatabaseFile();
  const collection = db[resource];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const item = fetchItemById(collection, id);
  if (!item) {
    return res.status(404).json({ error: 'Not found' });
  }

  const access = computeAccessRights(item, req, db);
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
    sharedWith: isOwner ? formatSharedWith(body.sharedWith ?? item.sharedWith) : item.sharedWith,
    sharedWithTeams: isOwner ? formatSharedWithTeams(body.sharedWithTeams ?? item.sharedWithTeams) : item.sharedWithTeams,
  };
  const index = collection.findIndex(entry => String(entry.id) === String(id));
  collection[index] = patchedItem;
  await writeDatabase(db);

  res.json(patchedItem);
});

app.delete('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  if (isInternalCollection(resource)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = loadDatabaseFile();
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
  await writeDatabase(db);

  res.status(204).end();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

try {
  setupDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`running on ${PORT}`);
});
