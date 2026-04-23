const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;

const jwtSecret = process.env.JWT_SECRET || 'defaultsecret';

let writeQueue = [];
let isWriting = false;

function enqueueWrite(operation) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ operation, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;
  const { operation, resolve, reject } = writeQueue.shift();
  operation().then(resolve).catch(reject).finally(() => {
    isWriting = false;
    processQueue();
  });
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error('DB_PATH environment variable is required');
  process.exit(1);
}

let db;
try {
  const data = fs.readFileSync(dbPath, 'utf8');
  if (data.trim() === '') {
    db = { "_users": [], "_teams": [] };
  } else {
    db = JSON.parse(data);
    if (!db || typeof db !== 'object' || !Array.isArray(db._users) || !Array.isArray(db._teams)) {
      db = { "_users": [], "_teams": [] };
    }
  }
} catch (e) {
  db = { "_users": [], "_teams": [] };
}

if (db["_users"]) {
  db["users"] = db["_users"];
  delete db["_users"];
}
if (db["_teams"]) {
  db["teams"] = db["_teams"];
  delete db["_teams"];
}

app.use(express.json());

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const users = db["_users"] = db["_users"] || [];
  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const role = users.length === 0 ? 'admin' : 'user';
  const newUser = { id: users.length + 1, username, password, role };
  users.push(newUser);
  await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = db["_users"] || [];
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret);
  res.json({ token });
});

app.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

app.get('/auth/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = db["_users"] || [];
  const safeUsers = users.map(u => ({ id: u.id, username: u.username, role: u.role }));
  res.json({ users: safeUsers });
});

app.patch('/auth/users/:id/role', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const { role } = req.body;
  if (!role || !['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const users = db["_users"] || [];
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = role;
  await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/auth/teams', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const teams = db["_teams"] = db["_teams"] || [];
  let maxId = 0;
  teams.forEach(t => { if (t.id > maxId) maxId = t.id; });
  const newTeam = { id: maxId + 1, name, ownerId: req.user.id, members: [req.user.id] };
  teams.push(newTeam);
  await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  res.status(201).json(newTeam);
});

app.post('/auth/teams/:id/members', authMiddleware, async (req, res) => {
  const teamId = parseInt(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const teams = db["_teams"] || [];
  const team = teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!team.members.includes(userId)) {
    team.members.push(userId);
    await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  }
  res.json(team);
});

app.delete('/auth/teams/:id/members/:userId', authMiddleware, async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  if (isNaN(teamId) || isNaN(userId)) return res.status(400).json({ error: 'Invalid ID' });
  const teams = db["_teams"] || [];
  const team = teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const index = team.members.indexOf(userId);
  if (index !== -1) {
    team.members.splice(index, 1);
    await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  }
  res.json(team);
});

app.get('/auth/teams', authMiddleware, (req, res) => {
  const teams = db["_teams"] || [];
  const userTeams = teams.filter(t => t.members.includes(req.user.id));
  res.json({ teams: userTeams });
});

app.get('/auth/teams/:id', authMiddleware, (req, res) => {
  const teamId = parseInt(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });
  const teams = db["_teams"] || [];
  const team = teams.find(t => t.id === teamId);
  if (!team || !team.members.includes(req.user.id)) {
    return res.status(404).json({ error: 'Team not found' });
  }
  res.json(team);
});

app.patch('/auth/teams/:id', authMiddleware, async (req, res) => {
  const teamId = parseInt(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const teams = db["_teams"] || [];
  const team = teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  team.name = name;
  await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  res.json(team);
});

app.delete('/auth/teams/:id', authMiddleware, async (req, res) => {
  const teamId = parseInt(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });
  const teams = db["_teams"] || [];
  const index = teams.findIndex(t => t.id === teamId);
  if (index === -1) return res.status(404).json({ error: 'Team not found' });
  const team = teams[index];
  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  teams.splice(index, 1);
  await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
  res.status(204).send();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.route('/:resource')
  .get(authMiddleware, (req, res) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resource = req.params.resource;
    let collection = db[resource] || [];
    if (req.user.role !== 'admin') {
      collection = collection.filter(item => 
        item.ownerId === req.user.id || 
        (item.sharedWith && item.sharedWith.some(s => s.userId === req.user.id)) ||
        (item.sharedWithTeams && item.sharedWithTeams.some(st => {
          const team = db["_teams"].find(t => t.id === st.teamId);
          return team && team.members.includes(req.user.id);
        }))
      );
    }

    // Apply query filters
    const query = req.query;
    const filters = [];
    let isOr = query._or === 'true';
    for (const [key, value] of Object.entries(query)) {
      if (['_sort', '_order', '_limit', '_offset', '_or'].includes(key)) continue;
      const parts = key.split('__');
      const field = parts[0];
      const op = parts[1] || 'eq';
      filters.push({ field, op, value });
    }
    if (filters.length > 0) {
      collection = collection.filter(item => {
        const results = filters.map(f => {
          const val = item[f.field];
          const v = f.value;
          switch (f.op) {
            case 'eq': return val == v || (v === 'true' && val === true) || (v === 'false' && val === false);
            case 'ne': return val != v;
            case 'gt': return Number(val) > Number(v);
            case 'gte': return Number(val) >= Number(v);
            case 'lt': return Number(val) < Number(v);
            case 'lte': return Number(val) <= Number(v);
            case 'between': const [lo, hi] = v.split(','); return Number(val) >= Number(lo) && Number(val) <= Number(hi);
            case 'contains': return String(val).toLowerCase().includes(v.toLowerCase());
            case 'startswith': return String(val).toLowerCase().startsWith(v.toLowerCase());
            case 'endswith': return String(val).toLowerCase().endsWith(v.toLowerCase());
            case 'in': return v.split(',').includes(String(val));
            default: return false;
          }
        });
        return isOr ? results.some(r => r) : results.every(r => r);
      });
    }

    // Sort
    if (query._sort) {
      collection.sort((a, b) => {
        const va = a[query._sort], vb = b[query._sort];
        if (query._order === 'desc') return vb > va ? 1 : vb < va ? -1 : 0;
        return va > vb ? 1 : va < vb ? -1 : 0;
      });
    }

    const total = collection.length;
    const offset = parseInt(query._offset) || 0;
    const limit = query._limit ? parseInt(query._limit) : undefined;
    const data = limit ? collection.slice(offset, offset + limit) : collection.slice(offset);

    if (query._limit !== undefined || query._offset !== undefined) {
      res.json({ data, total, limit: limit || data.length, offset });
    } else {
      res.json(collection);
    }
  })
  .post(authMiddleware, async (req, res) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resource = req.params.resource;
    if (!db[resource]) db[resource] = [];
    const collection = db[resource];
    const newItem = { ...req.body };
    delete newItem.id;
    delete newItem.ownerId;
    delete newItem.createdAt;
    let maxId = 0;
    collection.forEach(item => {
      if (item.id > maxId) maxId = item.id;
    });
    newItem.id = maxId + 1;
    newItem.ownerId = req.user.id;
    newItem.createdAt = new Date().toISOString();
    collection.push(newItem);
    await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
    res.status(201).json(newItem);
  });

app.route('/:resource/:id')
  .get(authMiddleware, (req, res) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resource = req.params.resource;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: 'Not found' });
    const collection = db[resource] || [];
    const item = collection.find(item => item.id === id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'admin' || item.ownerId === req.user.id) {
      return res.json(item);
    }
    if (item.sharedWith) {
      const share = item.sharedWith.find(s => s.userId === req.user.id);
      if (share && (share.access === 'read' || share.access === 'write')) {
        return res.json(item);
      }
    }
    if (item.sharedWithTeams) {
      const teamShare = item.sharedWithTeams.find(st => {
        const team = db["_teams"].find(t => t.id === st.teamId);
        return team && team.members.includes(req.user.id) && (st.access === 'read' || st.access === 'write');
      });
      if (teamShare) {
        return res.json(item);
      }
    }
    return res.status(403).json({ error: 'Forbidden' });
  })
  .put(authMiddleware, async (req, res) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resource = req.params.resource;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: 'Not found' });
    const collection = db[resource] || [];
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    const item = collection[index];
    let canWrite = req.user.role === 'admin' || item.ownerId === req.user.id;
    if (!canWrite && item.sharedWith) {
      const share = item.sharedWith.find(s => s.userId === req.user.id);
      if (share && share.access === 'write') {
        canWrite = true;
      }
    }
    if (!canWrite && item.sharedWithTeams) {
      const teamShare = item.sharedWithTeams.find(st => {
        const team = db["_teams"].find(t => t.id === st.teamId);
        return team && team.members.includes(req.user.id) && st.access === 'write';
      });
      if (teamShare) {
        canWrite = true;
      }
    }
    if (!canWrite) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updatedItem = { ...req.body };
    delete updatedItem.id;
    delete updatedItem.ownerId;
    delete updatedItem.createdAt;
    Object.assign(collection[index], updatedItem);
    collection[index].updatedAt = new Date().toISOString();
    await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
    res.json(collection[index]);
  })
  .patch(authMiddleware, async (req, res) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resource = req.params.resource;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: 'Not found' });
    const collection = db[resource] || [];
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    const item = collection[index];
    let canWrite = req.user.role === 'admin' || item.ownerId === req.user.id;
    if (!canWrite && item.sharedWith) {
      const share = item.sharedWith.find(s => s.userId === req.user.id);
      if (share && share.access === 'write') {
        canWrite = true;
      }
    }
    if (!canWrite && item.sharedWithTeams) {
      const teamShare = item.sharedWithTeams.find(st => {
        const team = db["_teams"].find(t => t.id === st.teamId);
        return team && team.members.includes(req.user.id) && st.access === 'write';
      });
      if (teamShare) {
        canWrite = true;
      }
    }
    if (!canWrite) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updates = req.body;
    delete updates.id;
    delete updates.ownerId;
    delete updates.createdAt;
    Object.assign(collection[index], updates);
    collection[index].updatedAt = new Date().toISOString();
    await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
    res.json(collection[index]);
  })
  .delete(authMiddleware, async (req, res) => {
    if (req.params.resource === '_users' || req.params.resource === '_teams') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resource = req.params.resource;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: 'Not found' });
    const collection = db[resource] || [];
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    const item = collection[index];
    if (req.user.role !== 'admin' && item.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    collection.splice(index, 1);
    await enqueueWrite(() => fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2)));
    res.status(204).send();
  });

app.listen(port, () => {
  console.log('running on');
});