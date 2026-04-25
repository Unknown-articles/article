const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { modifyDB, readDB } = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  // check if req url = "/health" then skip token verification
  if (req.path === '/health') return res.status(200).json({ status: 'ok' });
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Token error' });

  jwt.verify(parts[1], JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  let newUser;
  try {
    await modifyDB(async (data) => {
      // Check if username taken
      const exists = data._users.find(u => u.username === username);
      if (exists) {
        const err = new Error('Username taken');
        err.status = 409;
        throw err;
      }

      const role = data._users.length === 0 ? 'admin' : 'user';
      const hashedPassword = await bcrypt.hash(password, 10);
      newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      data._users.push(newUser);
      return data;
    });

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const data = await readDB();
    const user = data._users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const data = await readDB();
    const user = data._users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = await readDB();
    const safeUsers = data._users.map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    res.status(200).json({ users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/role', verifyToken, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }

  let updatedUser;
  try {
    await modifyDB(async (data) => {
      const user = data._users.find(u => u.id === req.params.id);
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }
      user.role = role;
      user.updatedAt = new Date().toISOString();
      updatedUser = user;
      return data;
    });

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.status(200).json(userWithoutPassword);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = {
  authRouter: router,
  verifyToken,
  requireAdmin
};
