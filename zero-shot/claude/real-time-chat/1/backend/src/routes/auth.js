import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = db
      .prepare('INSERT INTO users (username, password) VALUES (?, ?)')
      .run(username.trim(), hashed);

    const userId = Number(result.lastInsertRowid);
    const token  = signToken({ userId, username: username.trim() });

    res.status(201).json({ token, userId, username: username.trim() });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username.trim());

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userId = Number(user.id);
    const token  = signToken({ userId, username: user.username });

    res.json({ token, userId, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
