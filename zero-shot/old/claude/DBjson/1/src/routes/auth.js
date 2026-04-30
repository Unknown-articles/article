'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db            = require('../db/fileDb');
const config        = require('../config');
const ApiError      = require('../errors/ApiError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safe(user) {
  const { password: _, ...rest } = user;
  return rest;
}

function requireAdmin(req) {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin role required');
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ApiError(400, 'username and password are required');
    }

    // Hash BEFORE acquiring the mutex so the synchronous transaction stays fast
    const hashed = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

    const newUser = db.transaction(data => {
      if (!data._users) data._users = [];

      if (data._users.find(u => u.username === username)) {
        throw new ApiError(409, 'Username already taken');
      }

      // First ever user automatically becomes admin
      const isFirst = data._users.length === 0;
      const user = {
        id:        uuidv4(),
        username,
        password:  hashed,
        role:      isFirst ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
      };
      data._users.push(user);
      return user;
    });

    res.status(201).json({ user: safe(await newUser) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ApiError(400, 'username and password are required');
    }

    const data = await db.read();
    const user = (data._users || []).find(u => u.username === username);
    if (!user) throw new ApiError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new ApiError(401, 'Invalid credentials');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({ token, user: safe(user) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const data = await db.read();
    const user = (data._users || []).find(u => u.id === req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json({ user: safe(user) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /auth/users  (admin only)
// ---------------------------------------------------------------------------
router.get('/users', authenticate, async (req, res, next) => {
  try {
    requireAdmin(req);
    const data = await db.read();
    res.json({ users: (data._users || []).map(safe) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PATCH /auth/users/:id/role  (admin only – promote / demote)
// ---------------------------------------------------------------------------
router.patch('/users/:id/role', authenticate, async (req, res, next) => {
  try {
    requireAdmin(req);
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      throw new ApiError(400, 'role must be "admin" or "user"');
    }
    const updated = await db.transaction(data => {
      const idx = (data._users || []).findIndex(u => u.id === req.params.id);
      if (idx === -1) throw new ApiError(404, 'User not found');
      data._users[idx].role = role;
      return data._users[idx];
    });
    res.json({ user: safe(updated) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

// POST /auth/teams
router.post('/teams', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) throw new ApiError(400, 'name is required');

    const team = await db.transaction(data => {
      if (!data._teams) data._teams = [];
      const t = {
        id:        uuidv4(),
        name,
        ownerId:   req.user.id,
        members:   [req.user.id],
        createdAt: new Date().toISOString(),
      };
      data._teams.push(t);
      return t;
    });
    res.status(201).json({ team });
  } catch (err) { next(err); }
});

// GET /auth/teams  – teams the caller owns or is a member of
router.get('/teams', authenticate, async (req, res, next) => {
  try {
    const data  = await db.read();
    const teams = (data._teams || []).filter(t =>
      req.user.role === 'admin' ||
      t.ownerId === req.user.id ||
      t.members.includes(req.user.id)
    );
    res.json({ teams });
  } catch (err) { next(err); }
});

// GET /auth/teams/:id
router.get('/teams/:id', authenticate, async (req, res, next) => {
  try {
    const data = await db.read();
    const team = (data._teams || []).find(t => t.id === req.params.id);
    if (!team) throw new ApiError(404, 'Team not found');
    if (
      req.user.role !== 'admin' &&
      team.ownerId !== req.user.id &&
      !team.members.includes(req.user.id)
    ) throw new ApiError(403, 'Forbidden');
    res.json({ team });
  } catch (err) { next(err); }
});

// PATCH /auth/teams/:id  – rename (owner / admin)
router.patch('/teams/:id', authenticate, async (req, res, next) => {
  try {
    const updated = await db.transaction(data => {
      const idx = (data._teams || []).findIndex(t => t.id === req.params.id);
      if (idx === -1) throw new ApiError(404, 'Team not found');
      const team = data._teams[idx];
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        throw new ApiError(403, 'Forbidden');
      }
      if (req.body.name) team.name = req.body.name;
      return team;
    });
    res.json({ team: updated });
  } catch (err) { next(err); }
});

// DELETE /auth/teams/:id  (owner / admin)
router.delete('/teams/:id', authenticate, async (req, res, next) => {
  try {
    await db.transaction(data => {
      const idx = (data._teams || []).findIndex(t => t.id === req.params.id);
      if (idx === -1) throw new ApiError(404, 'Team not found');
      const team = data._teams[idx];
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        throw new ApiError(403, 'Forbidden');
      }
      data._teams.splice(idx, 1);
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /auth/teams/:id/members  – add member (owner / admin)
router.post('/teams/:id/members', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new ApiError(400, 'userId is required');

    const updated = await db.transaction(data => {
      const team = (data._teams || []).find(t => t.id === req.params.id);
      if (!team) throw new ApiError(404, 'Team not found');
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        throw new ApiError(403, 'Forbidden');
      }
      if (!data._users.find(u => u.id === userId)) {
        throw new ApiError(404, 'User not found');
      }
      if (!team.members.includes(userId)) team.members.push(userId);
      return team;
    });
    res.json({ team: updated });
  } catch (err) { next(err); }
});

// DELETE /auth/teams/:id/members/:userId  (owner / admin)
router.delete('/teams/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    const updated = await db.transaction(data => {
      const team = (data._teams || []).find(t => t.id === req.params.id);
      if (!team) throw new ApiError(404, 'Team not found');
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        throw new ApiError(403, 'Forbidden');
      }
      team.members = team.members.filter(id => id !== req.params.userId);
      return team;
    });
    res.json({ team: updated });
  } catch (err) { next(err); }
});

module.exports = router;

// Ownership note: every resource item stores ownerId = req.user.id on creation.
// Only the owner or admin can DELETE; shared-write users can PUT/PATCH.
