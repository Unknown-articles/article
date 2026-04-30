const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');
const { authenticate, requireRole, JWT_SECRET } = require('./middleware');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const db = await readDb();
    if (!db._users) db._users = [];

    const existingUser = db._users.find(u => u.username === username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const isFirstUser = db._users.length === 0;
    const role = isFirstUser ? 'admin' : 'user';
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id,
      username,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db._users.push(newUser);
    await writeDb(db);

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const db = await readDb();
    const user = (db._users || []).find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Unknown username' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const db = await readDb();
    const user = (db._users || []).find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const db = await readDb();
    const users = (db._users || []).map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id/role', authenticate, requireRole('admin'), async (req, res) => {
  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const db = await readDb();
    const userIndex = (db._users || []).findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    db._users[userIndex].role = role;
    db._users[userIndex].updatedAt = new Date().toISOString();
    await writeDb(db);

    const { password: _, ...userWithoutPassword } = db._users[userIndex];
    res.status(200).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const teamsRouter = require('./teams');
router.use('/teams', teamsRouter);

module.exports = router;
