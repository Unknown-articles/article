const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB, updateDB } = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    let newUser;
    await updateDB(data => {
      const existing = data._users.find(u => u.username === username);
      if (existing) {
        const error = new Error('Username taken');
        error.status = 409;
        throw error;
      }
      const role = data._users.length === 0 ? 'admin' : 'user';
      const hashedPassword = bcrypt.hashSync(password, 10);
      newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        role,
        createdAt: new Date().toISOString()
      };
      data._users.push(newUser);
      return data;
    });

    res.status(201).json(sanitizeUser(newUser));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await getDB();
  const user = db._users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Unknown username' });
  }
  const match = bcrypt.compareSync(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

router.get('/me', authenticate, async (req, res) => {
  const db = await getDB();
  const user = db._users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  res.json(sanitizeUser(user));
});

router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const db = await getDB();
  const users = db._users.map(sanitizeUser);
  res.json({ users });
});

router.patch('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    let updatedUser;
    await updateDB(data => {
      const user = data._users.find(u => u.id === req.params.id);
      if (!user) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
      }
      user.role = role;
      updatedUser = user;
      return data;
    });
    res.json(sanitizeUser(updatedUser));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, authenticate, requireAdmin };
