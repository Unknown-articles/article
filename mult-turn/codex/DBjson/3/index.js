const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const INITIAL_STORE = { _users: [], _teams: [] };
const HTTP_PORT = process.env.PORT || 3000;
const STORE_FILE = process.env.DB_PATH;
const AUTH_SECRET = process.env.JWT_SECRET || 'development-secret';
const BCRYPT_COST = 10;
const INTERNAL_COLLECTIONS = new Set(['_users', '_teams']);
const ROLE_OPTIONS = new Set(['admin', 'user']);
const SHARE_PERMISSIONS = new Set(['read', 'write']);
const QUERY_META_KEYS = new Set(['_sort', '_order', '_limit', '_offset', '_or']);
const QUERY_OPERATIONS = new Set([
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

let storeLocation;
let queuedWrite = Promise.resolve();

function bootstrapStore(storePath) {
  if (!storePath) {
    throw new Error('DB_PATH environment variable is required');
  }

  storeLocation = path.resolve(storePath);
  const parentDirectory = path.dirname(storeLocation);

  fs.mkdirSync(parentDirectory, { recursive: true });

  if (!fs.existsSync(storeLocation) || fs.readFileSync(storeLocation, 'utf8').trim() === '') {
    fs.writeFileSync(storeLocation, `${JSON.stringify(INITIAL_STORE, null, 2)}\n`);
    return INITIAL_STORE;
  }

  const sourceText = fs.readFileSync(storeLocation, 'utf8');
  return JSON.parse(sourceText);
}

async function fetchStore() {
  const sourceText = await fs.promises.readFile(storeLocation, 'utf8');
  return JSON.parse(sourceText);
}

async function fetchSyncedStore() {
  await queuedWrite;
  return fetchStore();
}

async function saveStore(stateSnapshot) {
  const renderedState = `${JSON.stringify(stateSnapshot, null, 2)}\n`;
  const tempStorePath = `${storeLocation}.${process.pid}.tmp`;

  await fs.promises.writeFile(tempStorePath, renderedState);
  await fs.promises.rename(tempStorePath, storeLocation);
}

function withStoreMutation(handler) {
  const pendingOperation = queuedWrite.then(async () => {
    const stateSnapshot = await fetchStore();
    const mutationResponse = await handler(stateSnapshot);

    if (mutationResponse.shouldWrite !== false) {
      await saveStore(stateSnapshot);
    }

    return mutationResponse.value;
  });

  queuedWrite = pendingOperation.catch(() => {});
  return pendingOperation;
}

function resolveCollectionAlias(resourceKey) {
  return resourceKey;
}

function pickCollection(stateSnapshot, resourceKey, ensureExists = false) {
  const collectionAlias = resolveCollectionAlias(resourceKey);

  if (!Array.isArray(stateSnapshot[collectionAlias])) {
    if (!ensureExists) {
      return [];
    }

    stateSnapshot[collectionAlias] = [];
  }

  return stateSnapshot[collectionAlias];
}

function issueId(records) {
  let nextId;

  do {
    nextId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (records.some((record) => String(record.id) === nextId));

  return nextId;
}

function presentUser(account) {
  return {
    id: account.id,
    username: account.username,
    role: account.role,
  };
}

function requireToken(req, res, next) {
  const authorizationHeader = req.get('authorization');

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  const bearerToken = authorizationHeader.slice('Bearer '.length).trim();

  if (!bearerToken) {
    res.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  try {
    const payload = jwt.verify(bearerToken, AUTH_SECRET);
    req.user = presentUser(payload);
    next();
  } catch (_error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdministrator(req, res, next) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

function rejectInternalCollection(req, res, next) {
  if (INTERNAL_COLLECTIONS.has(req.params.resource)) {
    res.status(403).json({ error: 'Reserved collection' });
    return;
  }

  next();
}

function userOwnsEntry(actor, entry) {
  return entry.ownerId === actor.id;
}

function userIsAdministrator(actor) {
  return actor.role === 'admin';
}

function locateSharedUserAccess(actor, entry) {
  if (!Array.isArray(entry.sharedWith)) {
    return null;
  }

  return entry.sharedWith.find((accessItem) => accessItem.userId === actor.id) || null;
}

function locateSharedTeamAccess(actor, entry, stateSnapshot) {
  if (!Array.isArray(entry.sharedWithTeams)) {
    return null;
  }

  const teams = pickCollection(stateSnapshot, '_teams');

  return (
    entry.sharedWithTeams.find((accessItem) => {
      const team = teams.find((teamRecord) => teamRecord.id === accessItem.teamId);
      return team && Array.isArray(team.members) && team.members.includes(actor.id);
    }) || null
  );
}

function hasReadAccess(actor, entry, stateSnapshot) {
  return (
    userIsAdministrator(actor) ||
    userOwnsEntry(actor, entry) ||
    Boolean(locateSharedUserAccess(actor, entry) || locateSharedTeamAccess(actor, entry, stateSnapshot))
  );
}

function hasWriteAccess(actor, entry, stateSnapshot) {
  const sharedUserAccess = locateSharedUserAccess(actor, entry);
  const sharedTeamAccess = locateSharedTeamAccess(actor, entry, stateSnapshot);

  return (
    userIsAdministrator(actor) ||
    userOwnsEntry(actor, entry) ||
    sharedUserAccess?.access === 'write' ||
    sharedTeamAccess?.access === 'write'
  );
}

function hasDeleteAccess(actor, entry) {
  return userIsAdministrator(actor) || userOwnsEntry(actor, entry);
}

function hasSharingAccess(actor, entry) {
  return userIsAdministrator(actor) || userOwnsEntry(actor, entry);
}

function omitSystemProperties(entry) {
  const { id, ownerId, createdAt, updatedAt, ...clientPayload } = entry;
  return clientPayload;
}

function omitSystemAndSharingProperties(entry) {
  const { sharedWith, sharedWithTeams, ...clientPayload } = omitSystemProperties(entry);
  return clientPayload;
}

function normalizeUserShares(sharedWith) {
  if (!Array.isArray(sharedWith)) {
    return [];
  }

  return sharedWith
    .filter(
      (accessItem) =>
        accessItem &&
        typeof accessItem.userId === 'string' &&
        SHARE_PERMISSIONS.has(accessItem.access)
    )
    .map((accessItem) => ({
      userId: accessItem.userId,
      access: accessItem.access,
    }));
}

function normalizeTeamShares(sharedWithTeams) {
  if (!Array.isArray(sharedWithTeams)) {
    return [];
  }

  return sharedWithTeams
    .filter(
      (accessItem) =>
        accessItem &&
        typeof accessItem.teamId === 'string' &&
        SHARE_PERMISSIONS.has(accessItem.access)
    )
    .map((accessItem) => ({
      teamId: accessItem.teamId,
      access: accessItem.access,
    }));
}

function userBelongsToTeam(actor, team) {
  return Array.isArray(team.members) && team.members.includes(actor.id);
}

function userOwnsTeam(actor, team) {
  return team.ownerId === actor.id;
}

function castQueryValue(rawValue) {
  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  if (rawValue !== '' && !Number.isNaN(Number(rawValue))) {
    return Number(rawValue);
  }

  return rawValue;
}

function readNestedValue(entry, dottedField) {
  return dottedField.split('.').reduce((current, segment) => {
    return current == null ? undefined : current[segment];
  }, entry);
}

function decodeFilter(filterKey, filterValue) {
  const segments = filterKey.split('__');
  const candidateOperator = segments[segments.length - 1];
  const operator = QUERY_OPERATIONS.has(candidateOperator) ? candidateOperator : 'eq';
  const field = operator === 'eq' ? filterKey : segments.slice(0, -1).join('__');

  return { field, operator, value: filterValue };
}

function filterMatches(entry, rule) {
  const actualValue = readNestedValue(entry, rule.field);
  const expectedValue = castQueryValue(rule.value);

  switch (rule.operator) {
    case 'eq':
      return actualValue === expectedValue;
    case 'ne':
      return actualValue !== expectedValue;
    case 'gt':
      return Number(actualValue) > Number(expectedValue);
    case 'gte':
      return Number(actualValue) >= Number(expectedValue);
    case 'lt':
      return Number(actualValue) < Number(expectedValue);
    case 'lte':
      return Number(actualValue) <= Number(expectedValue);
    case 'between': {
      const [floor, ceiling] = String(rule.value).split(',').map(Number);
      return Number(actualValue) >= floor && Number(actualValue) <= ceiling;
    }
    case 'contains':
      return String(actualValue ?? '').toLowerCase().includes(String(rule.value).toLowerCase());
    case 'startswith':
      return String(actualValue ?? '').toLowerCase().startsWith(String(rule.value).toLowerCase());
    case 'endswith':
      return String(actualValue ?? '').toLowerCase().endsWith(String(rule.value).toLowerCase());
    case 'in':
      return String(rule.value)
        .split(',')
        .map(castQueryValue)
        .some((candidate) => candidate === actualValue);
    default:
      return true;
  }
}

function executeQuery(entries, queryParams) {
  const activeRules = Object.entries(queryParams)
    .filter(([key]) => !QUERY_META_KEYS.has(key))
    .map(([key, value]) => decodeFilter(key, value));
  const useOrMode = queryParams._or === 'true';
  let workingSet = entries;

  if (activeRules.length > 0) {
    workingSet = workingSet.filter((entry) => {
      const evaluations = activeRules.map((rule) => filterMatches(entry, rule));
      return useOrMode ? evaluations.some(Boolean) : evaluations.every(Boolean);
    });
  }

  if (queryParams._sort) {
    const direction = queryParams._order === 'desc' ? -1 : 1;
    const sortField = queryParams._sort;

    workingSet = [...workingSet].sort((leftEntry, rightEntry) => {
      const leftValue = readNestedValue(leftEntry, sortField);
      const rightValue = readNestedValue(rightEntry, sortField);

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

  const paginate = queryParams._limit !== undefined || queryParams._offset !== undefined;

  if (!paginate) {
    return workingSet;
  }

  const total = workingSet.length;
  const limit = queryParams._limit === undefined ? total : Math.max(Number(queryParams._limit), 0);
  const offset = queryParams._offset === undefined ? 0 : Math.max(Number(queryParams._offset), 0);

  return {
    data: workingSet.slice(offset, offset + limit),
    total,
    limit,
    offset,
  };
}

function nextUpdatedTimestamp(createdAt) {
  const currentTime = new Date();
  const createdTime = Date.parse(createdAt);

  if (!Number.isNaN(createdTime) && currentTime.getTime() <= createdTime) {
    return new Date(createdTime + 1).toISOString();
  }

  return currentTime.toISOString();
}

bootstrapStore(STORE_FILE);

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

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const created = await withStoreMutation((stateSnapshot) => {
      const users = pickCollection(stateSnapshot, '_users', true);
      const existingUser = users.find((entry) => entry.username === username);

      if (existingUser) {
        return { value: null, shouldWrite: false };
      }

      const createdUser = {
        id: issueId(users),
        username,
        passwordHash,
        role: users.length === 0 ? 'admin' : 'user',
      };

      users.push(createdUser);
      return { value: presentUser(createdUser) };
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

    const stateSnapshot = await fetchSyncedStore();
    const account = pickCollection(stateSnapshot, '_users').find((entry) => entry.username === username);

    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = jwt.sign(presentUser(account), AUTH_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/me', requireToken, (req, res) => {
  res.status(200).json(req.user);
});

app.get('/auth/users', requireToken, requireAdministrator, async (_req, res, next) => {
  try {
    const stateSnapshot = await fetchSyncedStore();
    const users = pickCollection(stateSnapshot, '_users').map(presentUser);

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

app.patch('/auth/users/:id/role', requireToken, requireAdministrator, async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!ROLE_OPTIONS.has(role)) {
      res.status(400).json({ error: 'Role must be admin or user' });
      return;
    }

    const updated = await withStoreMutation((stateSnapshot) => {
      const users = pickCollection(stateSnapshot, '_users');
      const account = users.find((entry) => String(entry.id) === req.params.id);

      if (!account) {
        return { value: null, shouldWrite: false };
      }

      account.role = role;
      return { value: presentUser(account) };
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

app.post('/auth/teams', requireToken, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const created = await withStoreMutation((stateSnapshot) => {
      const teams = pickCollection(stateSnapshot, '_teams', true);
      const createdTeam = {
        id: issueId(teams),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
      };

      teams.push(createdTeam);
      return { value: createdTeam };
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/teams', requireToken, async (req, res, next) => {
  try {
    const stateSnapshot = await fetchSyncedStore();
    const teams = pickCollection(stateSnapshot, '_teams').filter((team) => userBelongsToTeam(req.user, team));

    res.status(200).json({ teams });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/teams/:id', requireToken, async (req, res, next) => {
  try {
    const stateSnapshot = await fetchSyncedStore();
    const team = pickCollection(stateSnapshot, '_teams').find((entry) => entry.id === req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!userBelongsToTeam(req.user, team)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(team);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/teams/:id/members', requireToken, async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const updated = await withStoreMutation((stateSnapshot) => {
      const teams = pickCollection(stateSnapshot, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!userIsAdministrator(req.user) && !userOwnsTeam(req.user, team)) {
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

app.delete('/auth/teams/:id/members/:userId', requireToken, async (req, res, next) => {
  try {
    const updated = await withStoreMutation((stateSnapshot) => {
      const teams = pickCollection(stateSnapshot, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!userOwnsTeam(req.user, team)) {
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

app.patch('/auth/teams/:id', requireToken, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const updated = await withStoreMutation((stateSnapshot) => {
      const teams = pickCollection(stateSnapshot, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!userOwnsTeam(req.user, team)) {
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

app.delete('/auth/teams/:id', requireToken, async (req, res, next) => {
  try {
    const deleted = await withStoreMutation((stateSnapshot) => {
      const teams = pickCollection(stateSnapshot, '_teams');
      const index = teams.findIndex((entry) => entry.id === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      if (!userOwnsTeam(req.user, teams[index])) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const [deletedTeam] = teams.splice(index, 1);
      return { value: deletedTeam };
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

app.get('/:resource', requireToken, rejectInternalCollection, async (req, res, next) => {
  try {
    const stateSnapshot = await fetchSyncedStore();
    const entries = pickCollection(stateSnapshot, req.params.resource);
    const allowedEntries =
      req.user.role === 'admin'
        ? entries
        : entries.filter((entry) => hasReadAccess(req.user, entry, stateSnapshot));

    res.status(200).json(executeQuery(allowedEntries, req.query));
  } catch (error) {
    next(error);
  }
});

app.get('/:resource/:id', requireToken, rejectInternalCollection, async (req, res, next) => {
  try {
    const stateSnapshot = await fetchSyncedStore();
    const entry = pickCollection(stateSnapshot, req.params.resource).find(
      (candidate) => String(candidate.id) === req.params.id
    );

    if (!entry) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!hasReadAccess(req.user, entry, stateSnapshot)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(entry);
  } catch (error) {
    next(error);
  }
});

app.post('/:resource', requireToken, rejectInternalCollection, async (req, res, next) => {
  try {
    const created = await withStoreMutation((stateSnapshot) => {
      const entries = pickCollection(stateSnapshot, req.params.resource, true);
      const createdAt = new Date().toISOString();
      const entry = {
        ...omitSystemProperties(req.body),
        sharedWith: normalizeUserShares(req.body.sharedWith),
        sharedWithTeams: normalizeTeamShares(req.body.sharedWithTeams),
        id: issueId(entries),
        ownerId: req.user.id,
        createdAt,
      };

      entries.push(entry);
      return { value: entry };
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/:resource/:id', requireToken, rejectInternalCollection, async (req, res, next) => {
  try {
    const updated = await withStoreMutation((stateSnapshot) => {
      const entries = pickCollection(stateSnapshot, req.params.resource);
      const index = entries.findIndex((entry) => String(entry.id) === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      const currentEntry = entries[index];

      if (!hasWriteAccess(req.user, currentEntry, stateSnapshot)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      entries[index] = {
        ...omitSystemAndSharingProperties(req.body),
        sharedWith: Array.isArray(currentEntry.sharedWith) ? currentEntry.sharedWith : [],
        sharedWithTeams: Array.isArray(currentEntry.sharedWithTeams)
          ? currentEntry.sharedWithTeams
          : [],
        id: currentEntry.id,
        ownerId: currentEntry.ownerId,
        createdAt: currentEntry.createdAt,
        updatedAt: nextUpdatedTimestamp(currentEntry.createdAt),
      };

      return { value: entries[index] };
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

app.patch('/:resource/:id', requireToken, rejectInternalCollection, async (req, res, next) => {
  try {
    const updated = await withStoreMutation((stateSnapshot) => {
      const entries = pickCollection(stateSnapshot, req.params.resource);
      const entry = entries.find((candidate) => String(candidate.id) === req.params.id);

      if (!entry) {
        return { value: null, shouldWrite: false };
      }

      if (!hasWriteAccess(req.user, entry, stateSnapshot)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const patchPayload = omitSystemProperties(req.body);

      if ('sharedWith' in patchPayload) {
        if (hasSharingAccess(req.user, entry)) {
          patchPayload.sharedWith = normalizeUserShares(patchPayload.sharedWith);
        } else {
          delete patchPayload.sharedWith;
        }
      }

      if ('sharedWithTeams' in patchPayload) {
        if (hasSharingAccess(req.user, entry)) {
          patchPayload.sharedWithTeams = normalizeTeamShares(patchPayload.sharedWithTeams);
        } else {
          delete patchPayload.sharedWithTeams;
        }
      }

      Object.assign(entry, patchPayload, {
        id: entry.id,
        ownerId: entry.ownerId,
        createdAt: entry.createdAt,
        updatedAt: nextUpdatedTimestamp(entry.createdAt),
      });

      return { value: entry };
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

app.delete('/:resource/:id', requireToken, rejectInternalCollection, async (req, res, next) => {
  try {
    const deleted = await withStoreMutation((stateSnapshot) => {
      const entries = pickCollection(stateSnapshot, req.params.resource);
      const index = entries.findIndex((entry) => String(entry.id) === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      if (!hasDeleteAccess(req.user, entries[index])) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const [deletedEntry] = entries.splice(index, 1);
      return { value: deletedEntry };
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

app.listen(HTTP_PORT, () => {
  console.log(`Server running on port ${HTTP_PORT}`);
});
