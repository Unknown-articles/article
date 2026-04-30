import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'chat_secret_key_change_in_prod';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password) VALUES (?, ?)'
  ).run(username, hashed);

  const userId = result.lastInsertRowid;
  const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ token, userId, username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  res.status(200).json({ token, userId: user.id, username: user.username });
});

export default router;
