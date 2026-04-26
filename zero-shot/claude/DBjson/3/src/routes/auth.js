const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { transaction, readDb } = require('../db/fileDb');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ApiError = require('../errors/ApiError');
const config = require('../config');

const router = express.Router();

function newId() {
  return crypto.randomUUID();
}

function safeUser(u) {
  const { password: _pw, ...rest } = u;
  return rest;
}

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw new ApiError(400, 'username and password are required');
    }

    const user = await transaction(db => {
      const existing = db._users.find(u => u.username === username);
      if (existing) throw new ApiError(409, 'Username already taken');

      const isFirst = db._users.length === 0;
      const hashed = bcrypt.hashSync(password, config.bcryptRounds);
      const newUser = {
        id: newId(),
        username,
        password: hashed,
        role: isFirst ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
      };
      db._users.push(newUser);
      return newUser;
    });

    res.status(201).json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw new ApiError(400, 'username and password are required');
    }

    const found = await readDb(db => db._users.find(u => u.username === username));
    if (!found || !bcrypt.compareSync(password, found.password)) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const token = jwt.sign(
      { id: found.id, username: found.username, role: found.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await readDb(db => db._users.find(u => u.id === req.user.id));
    if (!user) throw new ApiError(404, 'User not found');
    res.json(safeUser(user));
  } catch (err) {
    next(err);
  }
});

// GET /auth/users  (admin only)
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const users = await readDb(db => db._users.map(safeUser));
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// PATCH /auth/users/:id/role  (admin only)
router.patch('/users/:id/role', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!['admin', 'user'].includes(role)) {
      throw new ApiError(400, 'role must be "admin" or "user"');
    }

    const updated = await transaction(db => {
      const user = db._users.find(u => u.id === req.params.id);
      if (!user) throw new ApiError(404, 'User not found');
      user.role = role;
      return user;
    });

    res.json(safeUser(updated));
  } catch (err) {
    next(err);
  }
});

// ─── Teams ───────────────────────────────────────────────────────────────────

// POST /auth/teams
router.post('/teams', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) throw new ApiError(400, 'name is required');

    const team = await transaction(db => {
      const newTeam = {
        id: newId(),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: new Date().toISOString(),
      };
      db._teams.push(newTeam);
      return newTeam;
    });

    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
});

// GET /auth/teams
router.get('/teams', authenticate, async (req, res, next) => {
  try {
    const teams = await readDb(db =>
      db._teams.filter(t => t.members.includes(req.user.id))
    );
    res.json({ teams });
  } catch (err) {
    next(err);
  }
});

// GET /auth/teams/:id
router.get('/teams/:id', authenticate, async (req, res, next) => {
  try {
    const team = await readDb(db => db._teams.find(t => t.id === req.params.id));
    if (!team) throw new ApiError(404, 'Team not found');
    if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not a member of this team');
    }
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

// PATCH /auth/teams/:id  (team owner)
router.patch('/teams/:id', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const updated = await transaction(db => {
      const team = db._teams.find(t => t.id === req.params.id);
      if (!team) throw new ApiError(404, 'Team not found');
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Only the team owner can update this team');
      }
      if (name) team.name = name;
      return team;
    });
    res.json({ team: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /auth/teams/:id  (team owner)
router.delete('/teams/:id', authenticate, async (req, res, next) => {
  try {
    await transaction(db => {
      const idx = db._teams.findIndex(t => t.id === req.params.id);
      if (idx === -1) throw new ApiError(404, 'Team not found');
      const team = db._teams[idx];
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Only the team owner can delete this team');
      }
      db._teams.splice(idx, 1);
    });
    res.status(200).json({ message: 'Team deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/teams/:id/members  (admin or team owner)
router.post('/teams/:id/members', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) throw new ApiError(400, 'userId is required');

    const updated = await transaction(db => {
      const team = db._teams.find(t => t.id === req.params.id);
      if (!team) throw new ApiError(404, 'Team not found');
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Only the team owner or admin can add members');
      }
      const userExists = db._users.find(u => u.id === userId);
      if (!userExists) throw new ApiError(404, 'User not found');
      if (!team.members.includes(userId)) {
        team.members.push(userId);
      }
      return team;
    });

    res.json({ team: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /auth/teams/:id/members/:userId  (team owner)
router.delete('/teams/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    const updated = await transaction(db => {
      const team = db._teams.find(t => t.id === req.params.id);
      if (!team) throw new ApiError(404, 'Team not found');
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Only the team owner can remove members');
      }
      team.members = team.members.filter(m => m !== req.params.userId);
      return team;
    });
    res.json({ team: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
