const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const makeAuthMiddleware = require('./middleware');
const { sanitizeUser, getUserTeamIds } = require('./utils');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

module.exports = function createAuthRouter(db) {
  const router = express.Router();
  const { authenticate, requireAdmin } = makeAuthMiddleware(db);

  async function getDB() {
    const data = await db.getData();
    if (!Array.isArray(data._users)) data._users = [];
    if (!Array.isArray(data._teams)) data._teams = [];
    return data;
  }

  router.post('/register', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const user = await db.withData(async (data) => {
      const users = data._users || [];
      if (users.some((entry) => entry.username === username)) {
        return null;
      }
      const role = users.length === 0 ? 'admin' : 'user';
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      const newUser = {
        id: uuidv4(),
        username,
        role,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      data._users = users.concat(newUser);
      return newUser;
    });

    if (!user) {
      return res.status(409).json({ error: 'username already taken' });
    }

    return res.status(201).json(sanitizeUser(user));
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const data = await getDB();
    const user = (data._users || []).find((entry) => entry.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '8h',
    });
    return res.json({ token });
  });

  router.get('/me', authenticate, async (req, res) => {
    const data = await getDB();
    const user = (data._users || []).find((entry) => entry.id === req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.json(sanitizeUser(user));
  });

  router.get('/users', authenticate, requireAdmin, async (req, res) => {
    const data = await getDB();
    const users = (data._users || []).map(sanitizeUser);
    return res.json({ users });
  });

  router.patch('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
    const { role } = req.body || {};
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or user' });
    }

    const updated = await db.withData(async (data) => {
      const user = (data._users || []).find((entry) => entry.id === req.params.id);
      if (!user) return null;
      user.role = role;
      user.updatedAt = new Date().toISOString();
      return user;
    });

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(sanitizeUser(updated));
  });

  router.post('/teams', authenticate, async (req, res) => {
    const { name } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }

    const team = await db.withData(async (data) => {
      const now = new Date().toISOString();
      const newTeam = {
        id: uuidv4(),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: now,
        updatedAt: now,
      };
      data._teams = Array.isArray(data._teams) ? data._teams.concat(newTeam) : [newTeam];
      return newTeam;
    });

    return res.status(201).json(team);
  });

  router.post('/teams/:id/members', authenticate, async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const updatedTeam = await db.withData(async (data) => {
      const team = (data._teams || []).find((entry) => entry.id === req.params.id);
      if (!team) return { error: 'not_found' };
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && team.ownerId !== req.user.id) {
        return { error: 'forbidden' };
      }
      const userExists = (data._users || []).some((entry) => entry.id === userId);
      if (!userExists) {
        return { error: 'user_not_found' };
      }
      if (!Array.isArray(team.members)) team.members = [];
      if (!team.members.includes(userId)) {
        team.members.push(userId);
      }
      team.updatedAt = new Date().toISOString();
      return team;
    });

    if (!updatedTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (updatedTeam.error === 'forbidden') {
      return res.status(403).json({ error: 'Only admin or team owner can add members' });
    }
    if (updatedTeam.error === 'user_not_found') {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(updatedTeam);
  });

  router.delete('/teams/:id/members/:userId', authenticate, async (req, res) => {
    const { id, userId } = req.params;

    const updatedTeam = await db.withData(async (data) => {
      const team = (data._teams || []).find((entry) => entry.id === id);
      if (!team) return { error: 'not_found' };
      if (team.ownerId !== req.user.id) {
        return { error: 'forbidden' };
      }
      if (userId === team.ownerId) {
        return { error: 'owner_remove' };
      }
      team.members = (team.members || []).filter((member) => member !== userId);
      team.updatedAt = new Date().toISOString();
      return team;
    });

    if (!updatedTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (updatedTeam.error === 'forbidden') {
      return res.status(403).json({ error: 'Only team owner can remove members' });
    }
    if (updatedTeam.error === 'owner_remove') {
      return res.status(400).json({ error: 'Cannot remove team owner' });
    }
    return res.json(updatedTeam);
  });

  router.get('/teams', authenticate, async (req, res) => {
    const data = await getDB();
    const teams = (data._teams || []).filter(
      (team) => Array.isArray(team.members) && team.members.includes(req.user.id)
    );
    return res.json({ teams });
  });

  router.get('/teams/:id', authenticate, async (req, res) => {
    const data = await getDB();
    const team = (data._teams || []).find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (!Array.isArray(team.members) || !team.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied to team' });
    }
    return res.json(team);
  });

  router.patch('/teams/:id', authenticate, async (req, res) => {
    const { name } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }

    const updatedTeam = await db.withData(async (data) => {
      const team = (data._teams || []).find((entry) => entry.id === req.params.id);
      if (!team) return null;
      if (team.ownerId !== req.user.id) return { error: 'forbidden' };
      team.name = name;
      team.updatedAt = new Date().toISOString();
      return team;
    });

    if (!updatedTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (updatedTeam.error === 'forbidden') {
      return res.status(403).json({ error: 'Only team owner can update team' });
    }
    return res.json(updatedTeam);
  });

  router.delete('/teams/:id', authenticate, async (req, res) => {
    const deleted = await db.withData(async (data) => {
      const teamIndex = (data._teams || []).findIndex((entry) => entry.id === req.params.id);
      if (teamIndex === -1) return null;
      const team = data._teams[teamIndex];
      if (team.ownerId !== req.user.id) return { error: 'forbidden' };
      data._teams.splice(teamIndex, 1);
      return team;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (deleted.error === 'forbidden') {
      return res.status(403).json({ error: 'Only team owner can delete team' });
    }
    return res.status(204).send();
  });

  return router;
};
