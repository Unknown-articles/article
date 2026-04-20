const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = './db.json';

let db = {};

const loadDb = async () => {
  try {
    db = await fs.readJson(DB_FILE);
  } catch (e) {
    db = { _users: [], teams: [] };
    await fs.writeJson(DB_FILE, db, { spaces: 2 });
  }
};

const saveDb = async () => {
  await fs.writeJson(DB_FILE, db, { spaces: 2 });
};

const JWT_SECRET = 'your-secret-key'; // In production, use env

// Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Helper to get user's teams
const getUserTeams = (userId) => {
  return db.teams.filter(team => team.members.includes(userId));
};

// Helper to check access to item
const canAccessItem = (item, userId, userRole) => {
  if (userRole === 'admin') return true;
  if (item.ownerId === userId) return true;
  if (item.sharedWith) {
    for (let share of item.sharedWith) {
      if (share.userId === userId) return true;
      if (share.teamId && getUserTeams(userId).some(t => t.id === share.teamId)) return true;
    }
  }
  return false;
};

const canWriteItem = (item, userId, userRole) => {
  if (userRole === 'admin') return true;
  if (item.ownerId === userId) return true;
  if (item.sharedWith) {
    for (let share of item.sharedWith) {
      if (share.userId === userId && share.permission === 'write') return true;
      if (share.teamId && getUserTeams(userId).some(t => t.id === share.teamId) && share.permission === 'write') return true;
    }
  }
  return false;
};

// Query helper
const applyQuery = (items, query) => {
  let filtered = [...items];
  const filters = [];
  const sorts = [];
  let limit = null;
  let offset = 0;
  let orMode = false;

  for (let key in query) {
    if (key === '_limit') {
      limit = parseInt(query[key]);
    } else if (key === '_offset') {
      offset = parseInt(query[key]);
    } else if (key === '_sort') {
      sorts.push({ field: query[key], order: 'asc' });
    } else if (key === '_order') {
      if (sorts.length > 0) sorts[sorts.length - 1].order = query[key];
    } else if (key === '_or') {
      orMode = query[key] === 'true';
    } else {
      // Filter
      let field = key;
      let op = '=';
      let value = query[key];
      if (key.includes('__')) {
        const parts = key.split('__');
        field = parts[0];
        op = parts[1];
      }
      filters.push({ field, op, value });
    }
  }

  // Apply filters
  if (filters.length > 0) {
    filtered = filtered.filter(item => {
      const results = filters.map(f => {
        let itemVal = item[f.field];
        let val = f.value;
        if (typeof itemVal === 'string') val = val.toLowerCase();
        if (typeof itemVal === 'string') itemVal = itemVal.toLowerCase();
        switch (f.op) {
          case 'ne': return itemVal != val;
          case 'gt': return itemVal > val;
          case 'gte': return itemVal >= val;
          case 'lt': return itemVal < val;
          case 'lte': return itemVal <= val;
          case 'contains': return itemVal.includes(val);
          case 'startswith': return itemVal.startsWith(val);
          case 'endswith': return itemVal.endsWith(val);
          case 'in': return val.split(',').includes(itemVal);
          case 'between': const [lo, hi] = val.split(','); return itemVal >= lo && itemVal <= hi;
          default: return itemVal == val;
        }
      });
      return orMode ? results.some(r => r) : results.every(r => r);
    });
  }

  // Sort
  for (let s of sorts.reverse()) {
    filtered.sort((a, b) => {
      let aVal = a[s.field];
      let bVal = b[s.field];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return s.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return s.order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Paginate
  if (offset > 0) filtered = filtered.slice(offset);
  if (limit) filtered = filtered.slice(0, limit);

  return filtered;
};

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const users = db._users;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username exists' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username,
    password: hashed,
    role: users.length === 0 ? 'admin' : 'user',
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await saveDb();
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db._users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token });
});

app.get('/auth/me', authenticate, (req, res) => {
  res.json(req.user);
});

app.get('/auth/users', authenticate, authorize(['admin']), (req, res) => {
  res.json(db._users.map(u => ({ id: u.id, username: u.username, role: u.role })));
});

app.patch('/auth/users/:id/role', authenticate, authorize(['admin']), async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = db._users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.role = role;
  await saveDb();
  res.json({ id: user.id, role: user.role });
});

// Teams
app.post('/auth/teams', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing name' });
  }
  const team = {
    id: uuidv4(),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
    createdAt: new Date().toISOString()
  };
  db.teams.push(team);
  await saveDb();
  res.json(team);
});

app.get('/auth/teams', authenticate, (req, res) => {
  const userTeams = getUserTeams(req.user.id);
  res.json(userTeams);
});

app.get('/auth/teams/:id', authenticate, (req, res) => {
  const team = db.teams.find(t => t.id === req.params.id);
  if (!team || !team.members.includes(req.user.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(team);
});

app.patch('/auth/teams/:id', authenticate, async (req, res) => {
  const team = db.teams.find(t => t.id === req.params.id);
  if (!team || team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name } = req.body;
  if (name) team.name = name;
  await saveDb();
  res.json(team);
});

app.delete('/auth/teams/:id', authenticate, async (req, res) => {
  const index = db.teams.findIndex(t => t.id === req.params.id);
  if (index === -1 || db.teams[index].ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.teams.splice(index, 1);
  await saveDb();
  res.json({ deleted: true });
});

app.post('/auth/teams/:id/members', authenticate, authorize(['admin']), async (req, res) => {
  const team = db.teams.find(t => t.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  const { userId } = req.body;
  if (!userId || !db._users.find(u => u.id === userId)) {
    return res.status(400).json({ error: 'Invalid user' });
  }
  if (!team.members.includes(userId)) {
    team.members.push(userId);
    await saveDb();
  }
  res.json(team);
});

app.delete('/auth/teams/:id/members/:userId', authenticate, async (req, res) => {
  const team = db.teams.find(t => t.id === req.params.id);
  if (!team || (team.ownerId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const index = team.members.indexOf(req.params.userId);
  if (index > -1) {
    team.members.splice(index, 1);
    await saveDb();
  }
  res.json(team);
});

// Dynamic routes
app.use('/:resource', authenticate, (req, res, next) => {
  const resource = req.params.resource;
  if (['_users', 'auth', 'teams'].includes(resource)) {
    return res.status(400).json({ error: 'Reserved' });
  }
  req.resource = resource;
  next();
});

app.get('/:resource', authenticate, (req, res) => {
  let items = db[req.resource] || [];
  items = items.filter(item => canAccessItem(item, req.user.id, req.user.role));
  items = applyQuery(items, req.query);
  res.json(items);
});

app.get('/:resource/:id', authenticate, (req, res) => {
  const item = db[req.resource]?.find(i => i.id === req.params.id);
  if (!item || !canAccessItem(item, req.user.id, req.user.role)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(item);
});

app.post('/:resource', authenticate, async (req, res) => {
  if (!db[req.resource]) db[req.resource] = [];
  const item = {
    ...req.body,
    id: uuidv4(),
    ownerId: req.user.id,
    createdAt: new Date().toISOString()
  };
  // Handle sharedWith
  if (item.sharedWith) {
    item.sharedWith = item.sharedWith.map(s => {
      if (typeof s === 'string') return { userId: s, permission: 'read' };
      return s;
    });
  }
  db[req.resource].push(item);
  await saveDb();
  res.json(item);
});

app.put('/:resource/:id', authenticate, async (req, res) => {
  const item = db[req.resource]?.find(i => i.id === req.params.id);
  if (!item || !canWriteItem(item, req.user.id, req.user.role)) {
    return res.status(404).json({ error: 'Not found' });
  }
  Object.assign(item, req.body, { id: item.id, ownerId: item.ownerId, createdAt: item.createdAt });
  await saveDb();
  res.json(item);
});

app.patch('/:resource/:id', authenticate, async (req, res) => {
  const item = db[req.resource]?.find(i => i.id === req.params.id);
  if (!item || !canWriteItem(item, req.user.id, req.user.role)) {
    return res.status(404).json({ error: 'Not found' });
  }
  Object.assign(item, req.body);
  delete item.id;
  delete item.ownerId;
  delete item.createdAt;
  await saveDb();
  res.json(item);
});

app.delete('/:resource/:id', authenticate, async (req, res) => {
  const index = db[req.resource]?.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Not found' });
  }
  const item = db[req.resource][index];
  if (!canWriteItem(item, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db[req.resource].splice(index, 1);
  await saveDb();
  res.json({ deleted: true });
});

// Start server
loadDb().then(() => {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
});