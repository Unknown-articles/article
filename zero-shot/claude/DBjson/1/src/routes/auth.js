'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { transaction, readOnly } = require('../db');
const { generateToken, authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const VALID_ROLES = ['admin', 'user'];

function stripPassword(user) {
  const { password, ...rest } = user;
  return rest;
}

// ── Register ──────────────────────────────────────────────────────────────────

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const user = await transaction(db => {
      if (db._users.find(u => u.username === username)) {
        const err = new Error('Username already taken');
        err.status = 409;
        throw err;
      }
      const newUser = {
        id: crypto.randomUUID(),
        username: String(username),
        password: hashedPassword,
        role: db._users.length === 0 ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
      };
      db._users.push(newUser);
      return newUser;
    });

    res.status(201).json(stripPassword(user));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let user;
    await readOnly(db => { user = db._users.find(u => u.username === username); });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(String(password), user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: generateToken(user) });
  } catch (err) {
    next(err);
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res, next) => {
  try {
    let user;
    await readOnly(db => { user = db._users.find(u => u.id === req.user.id); });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(stripPassword(user));
  } catch (err) {
    next(err);
  }
});

// ── User management (admin only) ──────────────────────────────────────────────

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    let users;
    await readOnly(db => { users = db._users.map(stripPassword); });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/role', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const updated = await transaction(db => {
      const idx = db._users.findIndex(u => u.id === req.params.id);
      if (idx === -1) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }
      db._users[idx] = { ...db._users[idx], role };
      return db._users[idx];
    });

    res.json(stripPassword(updated));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Teams ─────────────────────────────────────────────────────────────────────

router.post('/teams', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Team name is required' });

    const team = await transaction(db => {
      const newTeam = {
        id: crypto.randomUUID(),
        name: String(name),
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: new Date().toISOString(),
      };
      db._teams.push(newTeam);
      return newTeam;
    });

    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
});

router.get('/teams', authenticate, async (req, res, next) => {
  try {
    let teams;
    await readOnly(db => {
      teams = db._teams.filter(t => t.members.includes(req.user.id));
    });
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

router.get('/teams/:id', authenticate, async (req, res, next) => {
  try {
    let team;
    await readOnly(db => { team = db._teams.find(t => t.id === req.params.id); });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not a team member' });
    }
    res.json(team);
  } catch (err) {
    next(err);
  }
});

router.patch('/teams/:id', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body || {};

    const updated = await transaction(db => {
      const idx = db._teams.findIndex(t => t.id === req.params.id);
      if (idx === -1) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      const team = db._teams[idx];
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Only team owner can update the team'); err.status = 403; throw err;
      }
      db._teams[idx] = { ...team, ...(name ? { name: String(name) } : {}) };
      return db._teams[idx];
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/teams/:id/members', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const updated = await transaction(db => {
      const teamIdx = db._teams.findIndex(t => t.id === req.params.id);
      if (teamIdx === -1) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      const team = db._teams[teamIdx];
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Only admin or team owner can add members'); err.status = 403; throw err;
      }
      if (!db._users.find(u => u.id === userId)) {
        const err = new Error('User not found'); err.status = 404; throw err;
      }
      if (!team.members.includes(userId)) {
        db._teams[teamIdx] = { ...team, members: [...team.members, userId] };
      }
      return db._teams[teamIdx];
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/teams/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    const updated = await transaction(db => {
      const teamIdx = db._teams.findIndex(t => t.id === req.params.id);
      if (teamIdx === -1) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      const team = db._teams[teamIdx];
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Only team owner can remove members'); err.status = 403; throw err;
      }
      db._teams[teamIdx] = {
        ...team,
        members: team.members.filter(m => m !== req.params.userId),
      };
      return db._teams[teamIdx];
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/teams/:id', authenticate, async (req, res, next) => {
  try {
    await transaction(db => {
      const idx = db._teams.findIndex(t => t.id === req.params.id);
      if (idx === -1) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      const team = db._teams[idx];
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Only team owner can delete the team'); err.status = 403; throw err;
      }
      db._teams.splice(idx, 1);
    });

    res.status(204).send();
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
