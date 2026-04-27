const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_EXPIRES_IN = '8h';

function createId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function omitPassword(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

async function requireAuth(req, res, next) {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const database = await db.readDatabase();
    const user = database._users.find((candidate) => candidate.id === payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.modifyDatabase(async (database) => {
      const existing = database._users.find((candidate) => candidate.username === username);
      if (existing) {
        const error = new Error('Username already taken');
        error.status = 409;
        throw error;
      }

      const role = database._users.length === 0 ? 'admin' : 'user';
      const now = new Date().toISOString();
      const newUser = {
        id: createId(),
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        createdAt: now,
      };

      database._users.push(newUser);
      return omitPassword(newUser);
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const database = await db.readDatabase();
    const user = database._users.find((candidate) => candidate.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = createToken(user);
    res.json({ token });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(omitPassword(req.user));
});

router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const database = await db.readDatabase();
    const users = database._users.map(omitPassword);
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/role', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Role must be "admin" or "user"' });
    }

    const updated = await db.modifyDatabase(async (database) => {
      const user = database._users.find((candidate) => candidate.id === req.params.id);
      if (!user) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
      }

      user.role = role;
      return omitPassword(user);
    });

    res.json(updated);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

function isTeamOwner(team, userId) {
  return team.ownerId === userId;
}

function userIsTeamMember(team, userId) {
  return Array.isArray(team.members) && team.members.includes(userId);
}

router.post('/teams', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const newTeam = await db.modifyDatabase(async (database) => {
      const now = new Date().toISOString();
      const team = {
        id: createId(),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: now,
      };
      database._teams.push(team);
      return team;
    });

    res.status(201).json(newTeam);
  } catch (error) {
    next(error);
  }
});

router.post('/teams/:id/members', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const updatedTeam = await db.modifyDatabase(async (database) => {
      const team = database._teams.find((candidate) => candidate.id === req.params.id);
      if (!team) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }

      if (!req.user || (req.user.role !== 'admin' && !isTeamOwner(team, req.user.id))) {
        const error = new Error('Admin or team owner required');
        error.status = 403;
        throw error;
      }

      const userExists = database._users.some((candidate) => candidate.id === userId);
      if (!userExists) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
      }

      team.members = Array.isArray(team.members) ? team.members : [];
      if (!team.members.includes(userId)) {
        team.members.push(userId);
      }

      return team;
    });

    res.json(updatedTeam);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/teams/:id/members/:userId', requireAuth, async (req, res, next) => {
  try {
    const teamId = req.params.id;
    const userId = req.params.userId;

    const updatedTeam = await db.modifyDatabase(async (database) => {
      const team = database._teams.find((candidate) => candidate.id === teamId);
      if (!team) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }

      if (!isTeamOwner(team, req.user.id)) {
        const error = new Error('Only the team owner can remove members');
        error.status = 403;
        throw error;
      }

      team.members = Array.isArray(team.members)
        ? team.members.filter((memberId) => memberId !== userId)
        : [];

      return team;
    });

    res.json(updatedTeam);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/teams', requireAuth, async (req, res, next) => {
  try {
    const database = await db.readDatabase();
    const teams = database._teams.filter((team) => userIsTeamMember(team, req.user.id));
    res.json({ teams });
  } catch (error) {
    next(error);
  }
});

router.get('/teams/:id', requireAuth, async (req, res, next) => {
  try {
    const database = await db.readDatabase();
    const team = database._teams.find((candidate) => candidate.id === req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!userIsTeamMember(team, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(team);
  } catch (error) {
    next(error);
  }
});

router.patch('/teams/:id', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (name == null) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const updatedTeam = await db.modifyDatabase(async (database) => {
      const team = database._teams.find((candidate) => candidate.id === req.params.id);
      if (!team) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }

      if (!isTeamOwner(team, req.user.id)) {
        const error = new Error('Only the team owner can update the team');
        error.status = 403;
        throw error;
      }

      team.name = name;
      return team;
    });

    res.json(updatedTeam);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/teams/:id', requireAuth, async (req, res, next) => {
  try {
    await db.modifyDatabase(async (database) => {
      const index = database._teams.findIndex((candidate) => candidate.id === req.params.id);
      if (index === -1) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }

      const team = database._teams[index];
      if (!isTeamOwner(team, req.user.id)) {
        const error = new Error('Only the team owner can delete the team');
        error.status = 403;
        throw error;
      }

      database._teams.splice(index, 1);
      return null;
    });

    res.status(204).end();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
