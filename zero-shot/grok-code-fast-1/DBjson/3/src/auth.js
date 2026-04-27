const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

module.exports = (db) => {
  const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
    next();
  };

  router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const data = await db.read();
    const users = data._users;
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username taken' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = users.length === 0 ? 'admin' : 'user';
    const user = { id: uuidv4(), username, password: hashedPassword, role };
    users.push(user);
    await db.enqueueWrite(async () => {
      await db.write({ ...data, _users: users });
    });
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const data = await db.read();
    const user = data._users.find(u => u.username === username);
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token });
  });

  router.get('/me', authenticate, async (req, res) => {
    const data = await db.read();
    const user = data._users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  router.get('/users', authenticate, requireAdmin, async (req, res) => {
    const data = await db.read();
    const users = data._users.map(u => {
      const { password, ...uWithout } = u;
      return uWithout;
    });
    res.json({ users });
  });

  router.patch('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const data = await db.read();
    const user = data._users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    await db.enqueueWrite(async () => {
      await db.write(data);
    });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  return { router, authenticate, requireAdmin };
};