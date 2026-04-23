import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username) {
      return res.status(400).json({ error: 'Username is missing' });
    }
    if (typeof username !== 'string' || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is missing' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const db = getDb();
    
    const hashedPassword = await bcrypt.hash(password, 10);

    let result;
    try {
      result = await db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        username,
        hashedPassword
      );
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Username already taken' });
      }
      throw err;
    }

    const userId = result.lastID;

    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({ token, userId, username });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username) {
      return res.status(400).json({ error: 'Username is missing' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is missing' });
    }

    const db = getDb();
    
    const user = await db.get('SELECT * FROM users WHERE username = ?', username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    return res.status(200).json({ token, userId: user.id, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
