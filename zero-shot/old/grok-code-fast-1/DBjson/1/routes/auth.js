const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../utils/fileOps');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/register', async (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = await readDB();
  if (!db.users) db.users = [];
  const existing = db.users.find(u => u.username === username);
  if (existing) return res.status(400).json({ error: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), username, password: hashedPassword, role };
  db.users.push(user);
  await writeDB(db);
  res.status(201).json({ message: 'User registered' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await readDB();
  const user = db.users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token });
});

module.exports = router;