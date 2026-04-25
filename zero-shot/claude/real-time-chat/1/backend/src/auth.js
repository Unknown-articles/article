import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET } from './config.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed);
    const userId = result.lastInsertRowid;
    const token = jwt.sign({ userId, username }, JWT_SECRET);
    return res.status(201).json({ token, userId, username });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, username }, JWT_SECRET);
  return res.status(200).json({ token, userId: user.id, username });
});

export default router;
