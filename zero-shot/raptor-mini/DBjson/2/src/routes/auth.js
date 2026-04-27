const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function findUserByUsername(username) {
  const users = await db.getCollection('_users');
  return users.find((user) => user.username === username);
}

async function findUserById(id) {
  const users = await db.getCollection('_users');
  return users.find((user) => user.id === id);
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const existing = await findUserByUsername(username);
  if (existing) {
    return res.status(409).json({ error: 'username already taken' });
  }

  const users = await db.getCollection('_users');
  const role = users.length === 0 ? 'admin' : 'user';
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id,
    username,
    role,
    passwordHash,
    createdAt,
    updatedAt: createdAt
  };

  await db.createItem('_users', user);
  return res.status(201).json(sanitizeUser(user));
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, config.jwtSecret, {
    expiresIn: config.tokenTtl
  });

  return res.json({ token });
});

router.get('/me', authenticateToken, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'invalid token' });
  }
  return res.json(sanitizeUser(user));
});

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  const users = await db.getCollection('_users');
  return res.json({ users: users.map(sanitizeUser) });
});

router.patch('/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'role must be admin or user' });
  }

  const updated = await db.updateCollectionItem('_users', req.params.id, (user) => {
    if (!user) return null;
    user.role = role;
    user.updatedAt = new Date().toISOString();
    return user;
  });

  if (!updated) {
    return res.status(404).json({ error: 'user not found' });
  }

  return res.json(sanitizeUser(updated));
});

router.post('/teams', authenticateToken, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'team name is required' });
  }

  const team = {
    id: crypto.randomUUID(),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.createItem('_teams', team);
  return res.status(201).json(team);
});

router.post('/teams/:id/members', authenticateToken, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const team = await db.getCollection('_teams').then((teams) => teams.find((t) => t.id === req.params.id));
  if (!team) {
    return res.status(404).json({ error: 'team not found' });
  }

  if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'must be team owner or admin' });
  }

  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  const updated = await db.updateCollectionItem('_teams', team.id, (current) => {
    if (!current) return null;
    if (!current.members.includes(userId)) {
      current.members.push(userId);
      current.updatedAt = new Date().toISOString();
    }
    return current;
  });

  return res.json(updated);
});

router.delete('/teams/:id/members/:userId', authenticateToken, async (req, res) => {
  const { id, userId } = req.params;
  const team = await db.getCollection('_teams').then((teams) => teams.find((t) => t.id === id));
  if (!team) {
    return res.status(404).json({ error: 'team not found' });
  }

  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'must be team owner to remove members' });
  }

  if (team.ownerId === userId) {
    return res.status(400).json({ error: 'cannot remove team owner' });
  }

  const updated = await db.updateCollectionItem('_teams', team.id, (current) => {
    if (!current) return null;
    current.members = current.members.filter((memberId) => memberId !== userId);
    current.updatedAt = new Date().toISOString();
    return current;
  });

  return res.json(updated);
});

router.get('/teams', authenticateToken, async (req, res) => {
  const teams = await db.getCollection('_teams');
  const result = teams.filter((team) => team.members.includes(req.user.id));
  return res.json({ teams: result });
});

router.get('/teams/:id', authenticateToken, async (req, res) => {
  const team = await db.getCollection('_teams').then((teams) => teams.find((t) => t.id === req.params.id));
  if (!team) {
    return res.status(404).json({ error: 'team not found' });
  }
  if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'must be a team member' });
  }
  return res.json(team);
});

router.patch('/teams/:id', authenticateToken, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'team name is required' });
  }

  const team = await db.getCollection('_teams').then((teams) => teams.find((t) => t.id === req.params.id));
  if (!team) {
    return res.status(404).json({ error: 'team not found' });
  }

  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'must be team owner' });
  }

  const updated = await db.updateCollectionItem('_teams', team.id, (current) => {
    if (!current) return null;
    current.name = name;
    current.updatedAt = new Date().toISOString();
    return current;
  });

  return res.json(updated);
});

router.delete('/teams/:id', authenticateToken, async (req, res) => {
  const team = await db.getCollection('_teams').then((teams) => teams.find((t) => t.id === req.params.id));
  if (!team) {
    return res.status(404).json({ error: 'team not found' });
  }

  if (team.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'must be team owner' });
  }

  const deleted = await db.deleteCollectionItem('_teams', team.id);
  if (!deleted) {
    return res.status(404).json({ error: 'team not found' });
  }

  return res.status(204).send();
});

module.exports = router;
