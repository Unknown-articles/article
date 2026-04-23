const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DEFAULT_DB = { _users: [], _teams: [] };
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH;
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const PASSWORD_SALT_ROUNDS = 10;
const RESERVED_COLLECTIONS = new Set(['_users', '_teams']);
const ALLOWED_ROLES = new Set(['admin', 'user']);
const ALLOWED_SHARED_ACCESS = new Set(['read', 'write']);
const RESERVED_QUERY_KEYS = new Set(['_sort', '_order', '_limit', '_offset', '_or']);
const FILTER_OPERATORS = new Set([
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'contains',
  'startswith',
  'endswith',
  'in',
]);
let resolvedDbPath;
let writeQueue = Promise.resolve();

function ensureDatabase(dbPath) {
  if (!dbPath) {
    throw new Error('DB_PATH environment variable is required');
  }

  resolvedDbPath = path.resolve(dbPath);
  const directory = path.dirname(resolvedDbPath);

  fs.mkdirSync(directory, { recursive: true });

  if (!fs.existsSync(resolvedDbPath) || fs.readFileSync(resolvedDbPath, 'utf8').trim() === '') {
    fs.writeFileSync(resolvedDbPath, `${JSON.stringify(DEFAULT_DB, null, 2)}\n`);
    return DEFAULT_DB;
  }

  const contents = fs.readFileSync(resolvedDbPath, 'utf8');
  return JSON.parse(contents);
}

async function readDatabase() {
  const contents = await fs.promises.readFile(resolvedDbPath, 'utf8');
  return JSON.parse(contents);
}

async function readStableDatabase() {
  await writeQueue;
  return readDatabase();
}

async function writeDatabase(data) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = `${resolvedDbPath}.${process.pid}.tmp`;

  await fs.promises.writeFile(tempPath, serialized);
  await fs.promises.rename(tempPath, resolvedDbPath);
}

function updateDatabase(updater) {
  const operation = writeQueue.then(async () => {
    const data = await readDatabase();
    const result = await updater(data);

    if (result.shouldWrite !== false) {
      await writeDatabase(data);
    }

    return result.value;
  });

  writeQueue = operation.catch(() => {});
  return operation;
}

function collectionName(resource) {
  return resource;
}

function getCollection(data, resource, createIfMissing = false) {
  const key = collectionName(resource);

  if (!Array.isArray(data[key])) {
    if (!createIfMissing) {
      return [];
    }

    data[key] = [];
  }

  return data[key];
}

function generateId(collection) {
  let id;

  do {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (collection.some((item) => String(item.id) === id));

  return id;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function authenticate(req, res, next) {
  const authHeader = req.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    res.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = publicUser(decoded);
    next();
  } catch (_error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

function blockReservedCollection(req, res, next) {
  if (RESERVED_COLLECTIONS.has(req.params.resource)) {
    res.status(403).json({ error: 'Reserved collection' });
    return;
  }

  next();
}

function isOwner(user, item) {
  return item.ownerId === user.id;
}

function isAdmin(user) {
  return user.role === 'admin';
}

function sharedGrant(user, item) {
  if (!Array.isArray(item.sharedWith)) {
    return null;
  }

  return item.sharedWith.find((grant) => grant.userId === user.id) || null;
}

function teamGrant(user, item, data) {
  if (!Array.isArray(item.sharedWithTeams)) {
    return null;
  }

  const teams = getCollection(data, '_teams');

  return (
    item.sharedWithTeams.find((grant) => {
      const team = teams.find((entry) => entry.id === grant.teamId);
      return team && Array.isArray(team.members) && team.members.includes(user.id);
    }) || null
  );
}

function canReadItem(user, item, data) {
  return isAdmin(user) || isOwner(user, item) || Boolean(sharedGrant(user, item) || teamGrant(user, item, data));
}

function canWriteItem(user, item, data) {
  const grant = sharedGrant(user, item);
  const team = teamGrant(user, item, data);
  return isAdmin(user) || isOwner(user, item) || grant?.access === 'write' || team?.access === 'write';
}

function canDeleteItem(user, item) {
  return isAdmin(user) || isOwner(user, item);
}

function canManageSharing(user, item) {
  return isAdmin(user) || isOwner(user, item);
}

function stripSystemFields(item) {
  const { id, ownerId, createdAt, updatedAt, ...rest } = item;
  return rest;
}

function stripSystemAndSharingFields(item) {
  const { sharedWith, sharedWithTeams, ...rest } = stripSystemFields(item);
  return rest;
}

function normalizeSharedWith(sharedWith) {
  if (!Array.isArray(sharedWith)) {
    return [];
  }

  return sharedWith
    .filter(
      (grant) =>
        grant &&
        typeof grant.userId === 'string' &&
        ALLOWED_SHARED_ACCESS.has(grant.access)
    )
    .map((grant) => ({
      userId: grant.userId,
      access: grant.access,
    }));
}

function normalizeSharedWithTeams(sharedWithTeams) {
  if (!Array.isArray(sharedWithTeams)) {
    return [];
  }

  return sharedWithTeams
    .filter(
      (grant) =>
        grant &&
        typeof grant.teamId === 'string' &&
        ALLOWED_SHARED_ACCESS.has(grant.access)
    )
    .map((grant) => ({
      teamId: grant.teamId,
      access: grant.access,
    }));
}

function isTeamMember(user, team) {
  return Array.isArray(team.members) && team.members.includes(user.id);
}

function isTeamOwner(user, team) {
  return team.ownerId === user.id;
}

function parseQueryValue(value) {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }

  return value;
}

function getFieldValue(item, field) {
  return field.split('.').reduce((value, key) => (value == null ? undefined : value[key]), item);
}

function parseFilter(key, value) {
  const parts = key.split('__');
  const possibleOperator = parts[parts.length - 1];
  const operator = FILTER_OPERATORS.has(possibleOperator) ? possibleOperator : 'eq';
  const field = operator === 'eq' ? key : parts.slice(0, -1).join('__');

  return { field, operator, value };
}

function matchesFilter(item, filter) {
  const actual = getFieldValue(item, filter.field);
  const expected = parseQueryValue(filter.value);

  switch (filter.operator) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'between': {
      const [low, high] = String(filter.value).split(',').map(Number);
      return Number(actual) >= low && Number(actual) <= high;
    }
    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(filter.value).toLowerCase());
    case 'startswith':
      return String(actual ?? '').toLowerCase().startsWith(String(filter.value).toLowerCase());
    case 'endswith':
      return String(actual ?? '').toLowerCase().endsWith(String(filter.value).toLowerCase());
    case 'in':
      return String(filter.value)
        .split(',')
        .map(parseQueryValue)
        .some((candidate) => candidate === actual);
    default:
      return true;
  }
}

function applyQuery(items, query) {
  const filters = Object.entries(query)
    .filter(([key]) => !RESERVED_QUERY_KEYS.has(key))
    .map(([key, value]) => parseFilter(key, value));
  const useOr = query._or === 'true';
  let results = items;

  if (filters.length > 0) {
    results = results.filter((item) => {
      const matches = filters.map((filter) => matchesFilter(item, filter));
      return useOr ? matches.some(Boolean) : matches.every(Boolean);
    });
  }

  if (query._sort) {
    const direction = query._order === 'desc' ? -1 : 1;
    const sortField = query._sort;

    results = [...results].sort((left, right) => {
      const leftValue = getFieldValue(left, sortField);
      const rightValue = getFieldValue(right, sortField);

      if (leftValue === rightValue) {
        return 0;
      }

      if (leftValue == null) {
        return 1;
      }

      if (rightValue == null) {
        return -1;
      }

      return leftValue > rightValue ? direction : -direction;
    });
  }

  const hasPagination = query._limit !== undefined || query._offset !== undefined;

  if (!hasPagination) {
    return results;
  }

  const total = results.length;
  const limit = query._limit === undefined ? total : Math.max(Number(query._limit), 0);
  const offset = query._offset === undefined ? 0 : Math.max(Number(query._offset), 0);

  return {
    data: results.slice(offset, offset + limit),
    total,
    limit,
    offset,
  };
}

function updatedTimestamp(createdAt) {
  const now = new Date();
  const createdTime = Date.parse(createdAt);

  if (!Number.isNaN(createdTime) && now.getTime() <= createdTime) {
    return new Date(createdTime + 1).toISOString();
  }

  return now.toISOString();
}

ensureDatabase(DB_PATH);

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/auth/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const created = await updateDatabase((data) => {
      const users = getCollection(data, '_users', true);
      const existingUser = users.find((user) => user.username === username);

      if (existingUser) {
        return { value: null, shouldWrite: false };
      }

      const user = {
        id: generateId(users),
        username,
        passwordHash,
        role: users.length === 0 ? 'admin' : 'user',
      };

      users.push(user);
      return { value: publicUser(user) };
    });

    if (!created) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const data = await readStableDatabase();
    const user = getCollection(data, '_users').find((entry) => entry.username === username);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/me', authenticate, (req, res) => {
  res.status(200).json(req.user);
});

app.get('/auth/users', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const data = await readStableDatabase();
    const users = getCollection(data, '_users').map(publicUser);

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

app.patch('/auth/users/:id/role', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!ALLOWED_ROLES.has(role)) {
      res.status(400).json({ error: 'Role must be admin or user' });
      return;
    }

    const updated = await updateDatabase((data) => {
      const users = getCollection(data, '_users');
      const user = users.find((entry) => String(entry.id) === req.params.id);

      if (!user) {
        return { value: null, shouldWrite: false };
      }

      user.role = role;
      return { value: publicUser(user) };
    });

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/teams', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const created = await updateDatabase((data) => {
      const teams = getCollection(data, '_teams', true);
      const team = {
        id: generateId(teams),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
      };

      teams.push(team);
      return { value: team };
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/teams', authenticate, async (req, res, next) => {
  try {
    const data = await readStableDatabase();
    const teams = getCollection(data, '_teams').filter((team) => isTeamMember(req.user, team));

    res.status(200).json({ teams });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/teams/:id', authenticate, async (req, res, next) => {
  try {
    const data = await readStableDatabase();
    const team = getCollection(data, '_teams').find((entry) => entry.id === req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!isTeamMember(req.user, team)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(team);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/teams/:id/members', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const updated = await updateDatabase((data) => {
      const teams = getCollection(data, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!isAdmin(req.user) && !isTeamOwner(req.user, team)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      if (!Array.isArray(team.members)) {
        team.members = [];
      }

      if (!team.members.includes(userId)) {
        team.members.push(userId);
      }

      return { value: team };
    });

    if (updated && updated.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/auth/teams/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    const updated = await updateDatabase((data) => {
      const teams = getCollection(data, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!isTeamOwner(req.user, team)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      team.members = Array.isArray(team.members)
        ? team.members.filter((memberId) => memberId !== req.params.userId)
        : [];

      return { value: team };
    });

    if (updated && updated.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

app.patch('/auth/teams/:id', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const updated = await updateDatabase((data) => {
      const teams = getCollection(data, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!isTeamOwner(req.user, team)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      team.name = name;
      return { value: team };
    });

    if (updated && updated.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/auth/teams/:id', authenticate, async (req, res, next) => {
  try {
    const deleted = await updateDatabase((data) => {
      const teams = getCollection(data, '_teams');
      const index = teams.findIndex((entry) => entry.id === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      if (!isTeamOwner(req.user, teams[index])) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const [team] = teams.splice(index, 1);
      return { value: team };
    });

    if (deleted && deleted.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!deleted) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(deleted);
  } catch (error) {
    next(error);
  }
});

app.get('/:resource', authenticate, blockReservedCollection, async (req, res, next) => {
  try {
    const data = await readStableDatabase();
    const collection = getCollection(data, req.params.resource);
    const items =
      req.user.role === 'admin'
        ? collection
        : collection.filter((item) => canReadItem(req.user, item, data));

    res.status(200).json(applyQuery(items, req.query));
  } catch (error) {
    next(error);
  }
});

app.get('/:resource/:id', authenticate, blockReservedCollection, async (req, res, next) => {
  try {
    const data = await readStableDatabase();
    const item = getCollection(data, req.params.resource).find(
      (entry) => String(entry.id) === req.params.id
    );

    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!canReadItem(req.user, item, data)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
});

app.post('/:resource', authenticate, blockReservedCollection, async (req, res, next) => {
  try {
    const created = await updateDatabase((data) => {
      const collection = getCollection(data, req.params.resource, true);
      const now = new Date().toISOString();
      const item = {
        ...stripSystemFields(req.body),
        sharedWith: normalizeSharedWith(req.body.sharedWith),
        sharedWithTeams: normalizeSharedWithTeams(req.body.sharedWithTeams),
        id: generateId(collection),
        ownerId: req.user.id,
        createdAt: now,
      };

      collection.push(item);
      return { value: item };
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/:resource/:id', authenticate, blockReservedCollection, async (req, res, next) => {
  try {
    const updated = await updateDatabase((data) => {
      const collection = getCollection(data, req.params.resource);
      const index = collection.findIndex((entry) => String(entry.id) === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      const existing = collection[index];

      if (!canWriteItem(req.user, existing, data)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      collection[index] = {
        ...stripSystemAndSharingFields(req.body),
        sharedWith: Array.isArray(existing.sharedWith) ? existing.sharedWith : [],
        sharedWithTeams: Array.isArray(existing.sharedWithTeams) ? existing.sharedWithTeams : [],
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: updatedTimestamp(existing.createdAt),
      };

      return { value: collection[index] };
    });

    if (updated && updated.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

app.patch('/:resource/:id', authenticate, blockReservedCollection, async (req, res, next) => {
  try {
    const updated = await updateDatabase((data) => {
      const collection = getCollection(data, req.params.resource);
      const item = collection.find((entry) => String(entry.id) === req.params.id);

      if (!item) {
        return { value: null, shouldWrite: false };
      }

      if (!canWriteItem(req.user, item, data)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const updates = stripSystemFields(req.body);

      if ('sharedWith' in updates) {
        if (canManageSharing(req.user, item)) {
          updates.sharedWith = normalizeSharedWith(updates.sharedWith);
        } else {
          delete updates.sharedWith;
        }
      }

      if ('sharedWithTeams' in updates) {
        if (canManageSharing(req.user, item)) {
          updates.sharedWithTeams = normalizeSharedWithTeams(updates.sharedWithTeams);
        } else {
          delete updates.sharedWithTeams;
        }
      }

      Object.assign(item, updates, {
        id: item.id,
        ownerId: item.ownerId,
        createdAt: item.createdAt,
        updatedAt: updatedTimestamp(item.createdAt),
      });
      return { value: item };
    });

    if (updated && updated.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/:resource/:id', authenticate, blockReservedCollection, async (req, res, next) => {
  try {
    const deleted = await updateDatabase((data) => {
      const collection = getCollection(data, req.params.resource);
      const index = collection.findIndex((entry) => String(entry.id) === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      if (!canDeleteItem(req.user, collection[index])) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const [item] = collection.splice(index, 1);
      return { value: item };
    });

    if (deleted && deleted.forbidden) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!deleted) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(deleted);
  } catch (error) {
    next(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
