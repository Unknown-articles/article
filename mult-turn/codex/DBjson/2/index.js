const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BASE_DATASET = { _users: [], _teams: [] };
const SERVICE_PORT = process.env.PORT || 3000;
const DATA_FILE_PATH = process.env.DB_PATH;
const TOKEN_SECRET = process.env.JWT_SECRET || 'development-secret';
const HASH_ROUNDS = 10;
const PROTECTED_COLLECTIONS = new Set(['_users', '_teams']);
const VALID_ROLES = new Set(['admin', 'user']);
const VALID_SHARE_LEVELS = new Set(['read', 'write']);
const SPECIAL_QUERY_KEYS = new Set(['_sort', '_order', '_limit', '_offset', '_or']);
const SUPPORTED_FILTER_OPERATORS = new Set([
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

let absoluteDataFile;
let pendingWriteChain = Promise.resolve();

function prepareStorage(dbFilePath) {
  if (!dbFilePath) {
    throw new Error('DB_PATH environment variable is required');
  }

  absoluteDataFile = path.resolve(dbFilePath);
  const storageDirectory = path.dirname(absoluteDataFile);

  fs.mkdirSync(storageDirectory, { recursive: true });

  if (!fs.existsSync(absoluteDataFile) || fs.readFileSync(absoluteDataFile, 'utf8').trim() === '') {
    fs.writeFileSync(absoluteDataFile, `${JSON.stringify(BASE_DATASET, null, 2)}\n`);
    return BASE_DATASET;
  }

  const rawStorage = fs.readFileSync(absoluteDataFile, 'utf8');
  return JSON.parse(rawStorage);
}

async function loadStorage() {
  const rawStorage = await fs.promises.readFile(absoluteDataFile, 'utf8');
  return JSON.parse(rawStorage);
}

async function loadStableStorage() {
  await pendingWriteChain;
  return loadStorage();
}

async function persistStorage(storageState) {
  const serializedState = `${JSON.stringify(storageState, null, 2)}\n`;
  const tempFile = `${absoluteDataFile}.${process.pid}.tmp`;

  await fs.promises.writeFile(tempFile, serializedState);
  await fs.promises.rename(tempFile, absoluteDataFile);
}

function mutateStorage(applyMutation) {
  const scheduledMutation = pendingWriteChain.then(async () => {
    const storageState = await loadStorage();
    const mutationResult = await applyMutation(storageState);

    if (mutationResult.shouldWrite !== false) {
      await persistStorage(storageState);
    }

    return mutationResult.value;
  });

  pendingWriteChain = scheduledMutation.catch(() => {});
  return scheduledMutation;
}

function resolveBucketName(resourceName) {
  return resourceName;
}

function accessBucket(storageState, resourceName, createIfMissing = false) {
  const bucketKey = resolveBucketName(resourceName);

  if (!Array.isArray(storageState[bucketKey])) {
    if (!createIfMissing) {
      return [];
    }

    storageState[bucketKey] = [];
  }

  return storageState[bucketKey];
}

function createRecordId(bucketItems) {
  let generatedId;

  do {
    generatedId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (bucketItems.some((entry) => String(entry.id) === generatedId));

  return generatedId;
}

function toSafeUser(account) {
  return {
    id: account.id,
    username: account.username,
    role: account.role,
  };
}

function verifySession(req, res, next) {
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
    const decoded = jwt.verify(token, TOKEN_SECRET);
    req.user = toSafeUser(decoded);
    next();
  } catch (_error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function enforceAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

function rejectProtectedBucket(req, res, next) {
  if (PROTECTED_COLLECTIONS.has(req.params.resource)) {
    res.status(403).json({ error: 'Reserved collection' });
    return;
  }

  next();
}

function ownsRecord(actor, record) {
  return record.ownerId === actor.id;
}

function hasAdminPrivileges(actor) {
  return actor.role === 'admin';
}

function findDirectGrant(actor, record) {
  if (!Array.isArray(record.sharedWith)) {
    return null;
  }

  return record.sharedWith.find((grant) => grant.userId === actor.id) || null;
}

function findTeamGrant(actor, record, storageState) {
  if (!Array.isArray(record.sharedWithTeams)) {
    return null;
  }

  const teamBucket = accessBucket(storageState, '_teams');

  return (
    record.sharedWithTeams.find((grant) => {
      const targetTeam = teamBucket.find((teamEntry) => teamEntry.id === grant.teamId);
      return (
        targetTeam &&
        Array.isArray(targetTeam.members) &&
        targetTeam.members.includes(actor.id)
      );
    }) || null
  );
}

function mayReadRecord(actor, record, storageState) {
  return (
    hasAdminPrivileges(actor) ||
    ownsRecord(actor, record) ||
    Boolean(findDirectGrant(actor, record) || findTeamGrant(actor, record, storageState))
  );
}

function mayWriteRecord(actor, record, storageState) {
  const directGrant = findDirectGrant(actor, record);
  const matchingTeamGrant = findTeamGrant(actor, record, storageState);

  return (
    hasAdminPrivileges(actor) ||
    ownsRecord(actor, record) ||
    directGrant?.access === 'write' ||
    matchingTeamGrant?.access === 'write'
  );
}

function mayDeleteRecord(actor, record) {
  return hasAdminPrivileges(actor) || ownsRecord(actor, record);
}

function mayManageSharing(actor, record) {
  return hasAdminPrivileges(actor) || ownsRecord(actor, record);
}

function removeSystemFields(record) {
  const { id, ownerId, createdAt, updatedAt, ...payload } = record;
  return payload;
}

function removeSystemAndSharingFields(record) {
  const { sharedWith, sharedWithTeams, ...payload } = removeSystemFields(record);
  return payload;
}

function sanitizeSharedUsers(sharedUsers) {
  if (!Array.isArray(sharedUsers)) {
    return [];
  }

  return sharedUsers
    .filter(
      (grant) =>
        grant &&
        typeof grant.userId === 'string' &&
        VALID_SHARE_LEVELS.has(grant.access)
    )
    .map((grant) => ({
      userId: grant.userId,
      access: grant.access,
    }));
}

function sanitizeSharedTeams(sharedTeams) {
  if (!Array.isArray(sharedTeams)) {
    return [];
  }

  return sharedTeams
    .filter(
      (grant) =>
        grant &&
        typeof grant.teamId === 'string' &&
        VALID_SHARE_LEVELS.has(grant.access)
    )
    .map((grant) => ({
      teamId: grant.teamId,
      access: grant.access,
    }));
}

function belongsToTeam(actor, team) {
  return Array.isArray(team.members) && team.members.includes(actor.id);
}

function ownsTeam(actor, team) {
  return team.ownerId === actor.id;
}

function parseQueryValue(rawValue) {
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

function getFieldValue(record, fieldName) {
  return fieldName.split('.').reduce((currentValue, key) => {
    return currentValue == null ? undefined : currentValue[key];
  }, record);
}

function parseFilter(rawKey, rawValue) {
  const keySegments = rawKey.split('__');
  const possibleOperator = keySegments[keySegments.length - 1];
  const operator = SUPPORTED_FILTER_OPERATORS.has(possibleOperator) ? possibleOperator : 'eq';
  const field = operator === 'eq' ? rawKey : keySegments.slice(0, -1).join('__');

  return { field, operator, value: rawValue };
}

function matchesFilter(record, filterRule) {
  const actualValue = getFieldValue(record, filterRule.field);
  const expectedValue = parseQueryValue(filterRule.value);

  switch (filterRule.operator) {
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
      const [low, high] = String(filterRule.value).split(',').map(Number);
      return Number(actualValue) >= low && Number(actualValue) <= high;
    }
    case 'contains':
      return String(actualValue ?? '').toLowerCase().includes(String(filterRule.value).toLowerCase());
    case 'startswith':
      return String(actualValue ?? '').toLowerCase().startsWith(String(filterRule.value).toLowerCase());
    case 'endswith':
      return String(actualValue ?? '').toLowerCase().endsWith(String(filterRule.value).toLowerCase());
    case 'in':
      return String(filterRule.value)
        .split(',')
        .map(parseQueryValue)
        .some((candidateValue) => candidateValue === actualValue);
    default:
      return true;
  }
}

function runQueryPipeline(records, queryParams) {
  const parsedFilters = Object.entries(queryParams)
    .filter(([key]) => !SPECIAL_QUERY_KEYS.has(key))
    .map(([key, value]) => parseFilter(key, value));
  const useOrLogic = queryParams._or === 'true';
  let results = records;

  if (parsedFilters.length > 0) {
    results = results.filter((record) => {
      const evaluation = parsedFilters.map((filterRule) => matchesFilter(record, filterRule));
      return useOrLogic ? evaluation.some(Boolean) : evaluation.every(Boolean);
    });
  }

  if (queryParams._sort) {
    const direction = queryParams._order === 'desc' ? -1 : 1;
    const sortField = queryParams._sort;

    results = [...results].sort((leftRecord, rightRecord) => {
      const leftValue = getFieldValue(leftRecord, sortField);
      const rightValue = getFieldValue(rightRecord, sortField);

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

  const hasPagination = queryParams._limit !== undefined || queryParams._offset !== undefined;

  if (!hasPagination) {
    return results;
  }

  const total = results.length;
  const limit = queryParams._limit === undefined ? total : Math.max(Number(queryParams._limit), 0);
  const offset = queryParams._offset === undefined ? 0 : Math.max(Number(queryParams._offset), 0);

  return {
    data: results.slice(offset, offset + limit),
    total,
    limit,
    offset,
  };
}

function buildUpdatedTimestamp(createdAt) {
  const now = new Date();
  const createdTime = Date.parse(createdAt);

  if (!Number.isNaN(createdTime) && now.getTime() <= createdTime) {
    return new Date(createdTime + 1).toISOString();
  }

  return now.toISOString();
}

prepareStorage(DATA_FILE_PATH);

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

    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    const created = await mutateStorage((storageState) => {
      const users = accessBucket(storageState, '_users', true);
      const existingUser = users.find((account) => account.username === username);

      if (existingUser) {
        return { value: null, shouldWrite: false };
      }

      const newAccount = {
        id: createRecordId(users),
        username,
        passwordHash,
        role: users.length === 0 ? 'admin' : 'user',
      };

      users.push(newAccount);
      return { value: toSafeUser(newAccount) };
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

    const storageState = await loadStableStorage();
    const account = accessBucket(storageState, '_users').find((entry) => entry.username === username);

    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = jwt.sign(toSafeUser(account), TOKEN_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/me', verifySession, (req, res) => {
  res.status(200).json(req.user);
});

app.get('/auth/users', verifySession, enforceAdmin, async (_req, res, next) => {
  try {
    const storageState = await loadStableStorage();
    const users = accessBucket(storageState, '_users').map(toSafeUser);

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

app.patch('/auth/users/:id/role', verifySession, enforceAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!VALID_ROLES.has(role)) {
      res.status(400).json({ error: 'Role must be admin or user' });
      return;
    }

    const updated = await mutateStorage((storageState) => {
      const users = accessBucket(storageState, '_users');
      const account = users.find((entry) => String(entry.id) === req.params.id);

      if (!account) {
        return { value: null, shouldWrite: false };
      }

      account.role = role;
      return { value: toSafeUser(account) };
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

app.post('/auth/teams', verifySession, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const created = await mutateStorage((storageState) => {
      const teams = accessBucket(storageState, '_teams', true);
      const newTeam = {
        id: createRecordId(teams),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
      };

      teams.push(newTeam);
      return { value: newTeam };
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/teams', verifySession, async (req, res, next) => {
  try {
    const storageState = await loadStableStorage();
    const teams = accessBucket(storageState, '_teams').filter((team) => belongsToTeam(req.user, team));

    res.status(200).json({ teams });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/teams/:id', verifySession, async (req, res, next) => {
  try {
    const storageState = await loadStableStorage();
    const team = accessBucket(storageState, '_teams').find((entry) => entry.id === req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!belongsToTeam(req.user, team)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(team);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/teams/:id/members', verifySession, async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const updated = await mutateStorage((storageState) => {
      const teams = accessBucket(storageState, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!hasAdminPrivileges(req.user) && !ownsTeam(req.user, team)) {
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

app.delete('/auth/teams/:id/members/:userId', verifySession, async (req, res, next) => {
  try {
    const updated = await mutateStorage((storageState) => {
      const teams = accessBucket(storageState, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!ownsTeam(req.user, team)) {
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

app.patch('/auth/teams/:id', verifySession, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const updated = await mutateStorage((storageState) => {
      const teams = accessBucket(storageState, '_teams');
      const team = teams.find((entry) => entry.id === req.params.id);

      if (!team) {
        return { value: null, shouldWrite: false };
      }

      if (!ownsTeam(req.user, team)) {
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

app.delete('/auth/teams/:id', verifySession, async (req, res, next) => {
  try {
    const deleted = await mutateStorage((storageState) => {
      const teams = accessBucket(storageState, '_teams');
      const index = teams.findIndex((entry) => entry.id === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      if (!ownsTeam(req.user, teams[index])) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const [removedTeam] = teams.splice(index, 1);
      return { value: removedTeam };
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

app.get('/:resource', verifySession, rejectProtectedBucket, async (req, res, next) => {
  try {
    const storageState = await loadStableStorage();
    const records = accessBucket(storageState, req.params.resource);
    const visibleRecords =
      req.user.role === 'admin'
        ? records
        : records.filter((record) => mayReadRecord(req.user, record, storageState));

    res.status(200).json(runQueryPipeline(visibleRecords, req.query));
  } catch (error) {
    next(error);
  }
});

app.get('/:resource/:id', verifySession, rejectProtectedBucket, async (req, res, next) => {
  try {
    const storageState = await loadStableStorage();
    const record = accessBucket(storageState, req.params.resource).find(
      (entry) => String(entry.id) === req.params.id
    );

    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!mayReadRecord(req.user, record, storageState)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
});

app.post('/:resource', verifySession, rejectProtectedBucket, async (req, res, next) => {
  try {
    const created = await mutateStorage((storageState) => {
      const records = accessBucket(storageState, req.params.resource, true);
      const now = new Date().toISOString();
      const record = {
        ...removeSystemFields(req.body),
        sharedWith: sanitizeSharedUsers(req.body.sharedWith),
        sharedWithTeams: sanitizeSharedTeams(req.body.sharedWithTeams),
        id: createRecordId(records),
        ownerId: req.user.id,
        createdAt: now,
      };

      records.push(record);
      return { value: record };
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/:resource/:id', verifySession, rejectProtectedBucket, async (req, res, next) => {
  try {
    const updated = await mutateStorage((storageState) => {
      const records = accessBucket(storageState, req.params.resource);
      const index = records.findIndex((entry) => String(entry.id) === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      const currentRecord = records[index];

      if (!mayWriteRecord(req.user, currentRecord, storageState)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      records[index] = {
        ...removeSystemAndSharingFields(req.body),
        sharedWith: Array.isArray(currentRecord.sharedWith) ? currentRecord.sharedWith : [],
        sharedWithTeams: Array.isArray(currentRecord.sharedWithTeams)
          ? currentRecord.sharedWithTeams
          : [],
        id: currentRecord.id,
        ownerId: currentRecord.ownerId,
        createdAt: currentRecord.createdAt,
        updatedAt: buildUpdatedTimestamp(currentRecord.createdAt),
      };

      return { value: records[index] };
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

app.patch('/:resource/:id', verifySession, rejectProtectedBucket, async (req, res, next) => {
  try {
    const updated = await mutateStorage((storageState) => {
      const records = accessBucket(storageState, req.params.resource);
      const record = records.find((entry) => String(entry.id) === req.params.id);

      if (!record) {
        return { value: null, shouldWrite: false };
      }

      if (!mayWriteRecord(req.user, record, storageState)) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const incomingChanges = removeSystemFields(req.body);

      if ('sharedWith' in incomingChanges) {
        if (mayManageSharing(req.user, record)) {
          incomingChanges.sharedWith = sanitizeSharedUsers(incomingChanges.sharedWith);
        } else {
          delete incomingChanges.sharedWith;
        }
      }

      if ('sharedWithTeams' in incomingChanges) {
        if (mayManageSharing(req.user, record)) {
          incomingChanges.sharedWithTeams = sanitizeSharedTeams(incomingChanges.sharedWithTeams);
        } else {
          delete incomingChanges.sharedWithTeams;
        }
      }

      Object.assign(record, incomingChanges, {
        id: record.id,
        ownerId: record.ownerId,
        createdAt: record.createdAt,
        updatedAt: buildUpdatedTimestamp(record.createdAt),
      });

      return { value: record };
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

app.delete('/:resource/:id', verifySession, rejectProtectedBucket, async (req, res, next) => {
  try {
    const deleted = await mutateStorage((storageState) => {
      const records = accessBucket(storageState, req.params.resource);
      const index = records.findIndex((entry) => String(entry.id) === req.params.id);

      if (index === -1) {
        return { value: null, shouldWrite: false };
      }

      if (!mayDeleteRecord(req.user, records[index])) {
        return { value: { forbidden: true }, shouldWrite: false };
      }

      const [removedRecord] = records.splice(index, 1);
      return { value: removedRecord };
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

app.listen(SERVICE_PORT, () => {
  console.log(`Server running on port ${SERVICE_PORT}`);
});
